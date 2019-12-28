import { Injectable } from '@angular/core';
import traverse from '@babel/traverse';
import { parse, ParserOptions } from '@babel/parser';
import * as Babel from '@babel/types';
import { BehaviorSubject } from 'rxjs';
import { Graph, Import, Link, Node } from '../interfaces';
import { reactMethods } from '../constants/special-methods';
import { FileWithPath } from '../helper/getFilesAsync';
import { excludedFolders, supportedExtensions } from '../constants/files';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  ast: Babel.File;
  files: FileWithPath[] = [];
  componentMap: {
    [componentName: string]: {
      graph?: Graph;
      imports?: { name: string; source: string }[];
      extends?: string;
      dependencies?: Set<string>;
    };
  } = {};
  appGraph: Graph = {
    nodes: [],
    links: []
  };
  componentFiles: FileWithPath[];

  graphData$ = new BehaviorSubject<Graph>(undefined);

  constructor() {}

  saveToLocalStorage() {
    if (this.graphData$.value) {
      console.log('Saving to local storage...');
      window.localStorage.setItem(
        'graph',
        JSON.stringify(this.graphData$.value)
      );
      window.localStorage.setItem(
        'components',
        JSON.stringify(this.componentMap)
      );
    }
  }

  restoreFromLocalStorage() {
    console.log('Restoring from local storage...');

    this.componentMap =
      JSON.parse(window.localStorage.getItem('components')) || {};
    const storedGraph: Graph = JSON.parse(window.localStorage.getItem('graph'));

    if (storedGraph) {
      console.log('ComponentMap: ', this.componentMap);
      console.log('Graph:', storedGraph);
      this.graphData$.next(storedGraph);
    }
  }

  async setFiles(files: FileWithPath[]) {
    console.log('setFiles: ', files);
    this.componentFiles = files.filter(file => {
      if (excludedFolders.some(folder => file.path.includes(folder))) {
        return;
      }

      const fileParts = file.path.split('.');
      return (
        fileParts.length >= 2 &&
        fileParts[fileParts.length - 2] !== 'test' &&
        supportedExtensions.includes(fileParts[fileParts.length - 1])
      );
    });
    console.log('componentFiles: ', this.componentFiles);

    for (const [index, file] of this.componentFiles.entries()) {
      await this.setFile(file);
      console.log(`Analyzing [${index + 1}/${this.componentFiles.length}]...`);
    }

    console.log('ComponentMap:', this.componentMap);
    console.log('Graph:', this.appGraph);

    for (const [path, value] of Object.entries(this.componentMap)) {
      value.dependencies.forEach(dependency => {
        if (!dependency.startsWith('/')) {
          return;
        }
        this.pushUniqueLink(
          {
            source: path,
            target: dependency
          },
          this.appGraph.links
        );
      });

      if (value.extends) {
        if (!this.appGraph.nodes.find(node => node.id === value.extends)) {
          console.log('Found a wrong super class path: ', value.extends);
        } else {
          this.pushUniqueLink(
            {
              source: value.extends,
              target: path
            },
            this.appGraph.links
          );
        }
      }
    }

    this.graphData$.next(this.appGraph);
  }

  async setFile(file: FileWithPath) {
    // @ts-ignore
    const code = await file.file.text();

    this.parse(code, file.path);
  }

  private parse(code: string, fileName?: string) {
    const fileExtension = fileName.split('.').pop();

    const options: ParserOptions = {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties']
    };

    if (fileExtension === 'tsx' || fileExtension === 'ts') {
      options.plugins.push('typescript');
    } else {
      options.plugins.push('flow');
    }

    this.ast = parse(code, options);

    // console.log('AST:', this.ast);

    this.componentMap[fileName] = {
      imports: [],
      graph: {
        nodes: [],
        links: []
      },
      dependencies: new Set<string>()
    };

    this.traverse(this.ast, fileName);
  }

  private traverse(ast: Babel.File, fileName: string) {
    const graph: Graph = {
      nodes: [],
      links: []
    };

    const aliases: { [alias: string]: string } = {};

    this.pushUniqueNode(
      {
        id: fileName,
        label: fileName
          .split('/')
          .pop()
          .split('.')[0]
      },
      this.appGraph.nodes
    );

    traverse(ast, {
      ClassDeclaration: path => {
        this.pushUniqueNode({ id: path.node.id.name, group: 2 }, graph.nodes);
        if (path.node.superClass) {
          const superClassName =
            path.node.superClass.name ||
            (path.node.superClass.property &&
              path.node.superClass.property.name);
          if (superClassName === 'Component') {
            return;
          }
          const extendsImport = this.componentMap[fileName].imports.find(
            theImport => theImport.name === path.node.superClass.name
          );
          if (!extendsImport) {
            return;
          }
          this.componentMap[fileName].extends = this.getImportPath(
            extendsImport,
            fileName
          );
        }
      },
      ClassMethod: path => {
        const methodName = path.node.key.name;
        const isReactMethod = reactMethods.includes(methodName);

        this.pushUniqueNode(
          { id: methodName, group: isReactMethod ? 3 : 1 },
          graph.nodes
        );

        if (isReactMethod) {
          this.pushUniqueLink(
            {
              source: path.context.scope.block.id.name,
              target: methodName
            },
            graph.links
          );
        }
      },
      ClassProperty: path => {
        if (
          path.node.value &&
          path.node.value.type === 'CallExpression' &&
          path.node.value.callee.property &&
          path.node.value.callee.property.name === 'bind'
        ) {
          this.pushUniqueNode({ id: path.node.key.name }, graph.nodes);
          const regularName = path.node.value.callee.object.property.name;
          const aliasName = path.node.key.name;
          aliases[aliasName] = regularName;
        }
      },
      ImportSpecifier: path => this.handleImport(path, fileName),
      ImportDefaultSpecifier: path => this.handleImport(path, fileName)
    });

    traverse(ast, {
      MemberExpression: path => {
        if (
          path.node.object.type === 'ThisExpression' &&
          path.node.property.type === 'Identifier' &&
          graph.nodes.find(node => node.id === path.node.property.name)
        ) {
          const classMethodName = this.getClassMethodName(path);

          if (!classMethodName) {
            return;
          }

          this.pushUniqueLink(
            {
              source: classMethodName,
              target: path.node.property.name
            },
            graph.links
          );
        }
      },
      CallExpression: path => {
        const calleeName = this.getCalleeName(path.node.callee);

        if (graph.nodes.find(node => node.id === calleeName)) {
          const classMethodName = this.getClassMethodName(path);

          if (!classMethodName) {
            return;
          }

          this.pushUniqueLink(
            {
              source: classMethodName,
              target: calleeName
            },
            graph.links
          );
        }
      },
      JSXIdentifier: path => {
        if (path.container.type === 'JSXOpeningElement') {
          const foundImport = this.componentMap[fileName].imports.find(
            theImport => theImport.name === path.node.name
          );

          if (foundImport) {
            const importPath = this.getImportPath(foundImport, fileName);
            this.componentMap[fileName].dependencies.add(importPath);
          }
        }
      }
    });

    this.mergeAliasesWithOriginals(graph, aliases);

    this.componentMap[fileName].graph = graph;
  }

  private handleImport(path, fileName: string) {
    if (!this.componentMap[fileName]) {
      this.componentMap[fileName] = {
        imports: []
      };
    }

    if (!this.componentMap[fileName].imports) {
      this.componentMap[fileName].imports = [];
    }

    this.componentMap[fileName].imports.push({
      name: path.node.local.name,
      source: path.parent.source.value
    });
  }

  private mergeAliasesWithOriginals(
    graph: Graph,
    aliases: { [alias: string]: string }
  ) {
    const linkIndexesToRemove = [];

    graph.nodes = graph.nodes.filter(
      node => !Object.keys(aliases).includes(node.id)
    );

    graph.links = graph.links.map((link, index) => {
      if (Object.keys(aliases).includes(link.source)) {
        link.source = aliases[link.source];
      }
      if (Object.keys(aliases).includes(link.target)) {
        link.target = aliases[link.target];
      }
      if (link.source === link.target) {
        linkIndexesToRemove.push(index);
      }
      return link;
    });

    linkIndexesToRemove.forEach(index => {
      graph.links.splice(index, 1);
    });
  }

  private getCalleeName(callee) {
    if (callee.type === 'MemberExpression') {
      return callee.property.name;
    } else if (callee.type === 'Identifier') {
      return callee.name;
    }
  }

  private getClassMethodName(path) {
    let currentPath = path;

    while (currentPath.scope.block.type !== 'ClassMethod') {
      currentPath = currentPath.parentPath;

      if (!currentPath) {
        return;
      }
    }

    return currentPath.scope.block.key.name;
  }

  private pushUniqueNode(node: Node, nodes: Node[]) {
    if (!nodes.find(searchNode => searchNode.id === node.id)) {
      nodes.push(node);
    }
  }

  private pushUniqueLink(link: Link, links: Link[]) {
    if (link.source === link.target) {
      return;
    }

    if (
      links.find(
        searchLink =>
          searchLink.source === link.source && searchLink.target === link.target
      )
    ) {
      return;
    }

    links.push(link);
  }

  private getImportPath(theImport: Import, basePath: string) {
    // npm module import
    if (!theImport.source.startsWith('.')) {
      return theImport.source;
    }

    const absolutePath = this.getAbsolutePath(theImport.source, basePath);

    return this.componentFiles.find(file => file.path.startsWith(absolutePath))
      .path;
  }

  private getAbsolutePath(relativePath: string, basePath: string) {
    const stack = basePath.split('/');
    const parts = relativePath.split('/');

    stack.pop(); // remove current file name

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '.') {
        continue;
      }
      if (parts[i] === '..') {
        stack.pop();
      } else {
        stack.push(parts[i]);
      }
    }

    return stack.join('/');
  }
}
