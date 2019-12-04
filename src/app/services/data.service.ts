import { Injectable } from '@angular/core';
import traverse from '@babel/traverse';
import { parse, ParserOptions } from '@babel/parser';
import * as Babel from '@babel/types';
import { BehaviorSubject } from 'rxjs';
import { Graph } from '../interfaces';

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
        this.parse(reader.result);
      }
    };
    reader.readAsText(file);
  }

  private parse(code: string) {
    const options: ParserOptions = {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties']
    };

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
        graph.nodes.push({ id: path.node.key.name });
        graph.links.push({
          source: path.context.scope.block.id.name,
          target: path.node.key.name
        });
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
        if (graph.nodes.find(node => node.id === path.node.callee.name)) {
          graph.links.push({
            source: path.scope.block.key.name,
            target: path.node.callee.name
          });
        }
      }
    });

    this.graphData$.next(graph);
  }
}
