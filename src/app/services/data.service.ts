import { Injectable } from '@angular/core';
import traverse from '@babel/traverse';
import { parse, ParserOptions } from '@babel/parser';
import * as Babel from '@babel/types';
import { BehaviorSubject } from 'rxjs';
import { Graph } from '../interfaces';
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

    traverse(ast, {
      ClassDeclaration: path => {
        graph.nodes.push({ id: path.node.id.name, group: 2 });
      },
      ClassMethod: path => {
        const methodName = path.node.key.name;
        const isReactMethod = reactMethods.includes(methodName);

        graph.nodes.push({ id: methodName, group: isReactMethod ? 3 : 1 });

        if (isReactMethod) {
          graph.links.push({
            source: path.context.scope.block.id.name,
            target: methodName
          });
        }
      }
    });

    traverse(ast, {
      MemberExpression: path => {
        if (
          path.node.object.type === 'ThisExpression' &&
          path.node.property.type === 'Identifier' &&
          graph.nodes.find(node => node.id === path.node.property.name) &&
          path.scope.block.type === 'ClassMethod'
        ) {
          graph.links.push({
            source: path.scope.block.key.name,
            target: path.node.property.name
          });
        }
      },
      CallExpression: path => {
        const calleeName = this.getCalleeName(path.node.callee);

        if (graph.nodes.find(node => node.id === calleeName)) {
          const classMethodName = this.getClassMethodName(path);

          if (!classMethodName) {
            return;
          }

          graph.links.push({
            source: classMethodName,
            target: calleeName
          });
        }
      }
    });

    this.graphData$.next(graph);
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
}
