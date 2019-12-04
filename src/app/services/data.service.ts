import { Injectable } from '@angular/core';
import traverse from '@babel/traverse';
import { parse, ParserOptions } from '@babel/parser';
import * as Babel from '@babel/types';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  ast: Babel.File;

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
    traverse(ast, {
      Identifier: path => {
        console.log('Identifier:', path.node.name);
      }
    });
  }
}
