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
      nodes: [{ id: 'Node1' }, { id: 'Node2' }],
      links: [{ source: 'Node1', target: 'Node2' }]
    };

    traverse(ast, {
      Identifier: path => {
        console.log('Identifier:', path.node.name);
      }
    });

    this.graphData$.next(graph);
  }
}
