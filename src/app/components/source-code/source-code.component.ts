import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild
} from '@angular/core';
import 'codemirror/mode/jsx/jsx.js';
import { CodemirrorComponent } from 'ng2-codemirror';

@Component({
  selector: 'app-source-code',
  templateUrl: './source-code.component.html',
  styleUrls: ['./source-code.component.scss']
})
export class SourceCodeComponent implements OnInit, AfterViewInit {
  @Input() code: string;

  @ViewChild('editor', { static: false }) editor: CodemirrorComponent;

  config = {
    mode: { name: 'jsx' },
    lineNumbers: true,
    readOnly: true,
    theme: 'neo'
  };

  constructor() {}

  ngOnInit() {}

  ngAfterViewInit(): void {
    this.editor.instance.setSize(null, '100%');
  }
}
