import { Component, Input, OnInit } from '@angular/core';
import 'codemirror/mode/jsx/jsx.js';

@Component({
  selector: 'app-source-code',
  templateUrl: './source-code.component.html',
  styleUrls: ['./source-code.component.scss']
})
export class SourceCodeComponent implements OnInit {
  @Input() code: string;
  config = {
    mode: { name: 'jsx' },
    lineNumbers: true,
    readOnly: true
  };

  constructor() {}

  ngOnInit() {}
}
