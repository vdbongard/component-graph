import { Injectable } from '@angular/core';
import traverse from '@babel/traverse';
import { parse, ParserOptions } from '@babel/parser';
import * as Babel from '@babel/types';
import { BehaviorSubject } from 'rxjs';
import { Graph, Link, Node } from '../interfaces';
import { reactMethods } from '../constants/special-methods';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  ast: Babel.File;

  graphData$ = new BehaviorSubject<Graph>(undefined);

  constructor() {}

  setFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const fileExtension = file.name.split('.').pop();
        this.parse(reader.result, fileExtension);
      }
    };
    reader.readAsText(file);
  }

  private parse(code: string, fileExtension?: string) {
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

    console.log('AST:', this.ast);

    this.traverse(this.ast);
  }

  private traverse(ast: Babel.File) {
    const graph: Graph = {
      nodes: [],
      links: []
    };

    const aliases: { [alias: string]: string } = {};

    traverse(ast, {
      ClassDeclaration: path => {
        this.pushUniqueNode({ id: path.node.id.name, group: 2 }, graph.nodes);
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
          path.node.value.callee.property.name === 'bind'
        ) {
          this.pushUniqueNode({ id: path.node.key.name }, graph.nodes);
          const regularName = path.node.value.callee.object.property.name;
          const aliasName = path.node.key.name;
          aliases[aliasName] = regularName;
        }
      }
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
      }
    });

    this.mergeAliasesWithOriginals(graph, aliases);

    this.graphData$.next(graph);
  }

  private mergeAliasesWithOriginals(
    graph: Graph,
    aliases: { [alias: string]: string }
  ) {
    graph.nodes = graph.nodes.filter(
      node => !Object.keys(aliases).includes(node.id)
    );

    graph.links = graph.links.map(link => {
      if (Object.keys(aliases).includes(link.source)) {
        link.source = aliases[link.source];
      }
      if (Object.keys(aliases).includes(link.target)) {
        link.target = aliases[link.target];
      }
      return link;
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
}
