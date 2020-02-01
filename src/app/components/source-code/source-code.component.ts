import {
  AfterViewInit,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import 'codemirror/mode/jsx/jsx.js';
import { CodemirrorComponent } from 'ng2-codemirror';
import { Selection } from '../../interfaces';

@Component({
  selector: 'app-source-code',
  templateUrl: './source-code.component.html',
  styleUrls: ['./source-code.component.scss']
})
export class SourceCodeComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() code: string;
  @Input() selection: Selection;

  @ViewChild('editor', { static: false }) editor: CodemirrorComponent;

  config = {
    mode: { name: 'jsx' },
    lineNumbers: true,
    readOnly: true,
    theme: 'neo'
  };
  timeoutId: number;

  constructor() {}

  ngOnInit() {}

  ngAfterViewInit(): void {
    this.editor.instance.setSize(null, '100%');
    this.editor.instance.on('change', () => {
      this.scrollAndSelect(this.selection.start, this.selection.end);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.selection && !changes.code) {
      if (!this.editor || !this.editor.instance) {
        return;
      }
      this.scrollAndSelect(
        changes.selection.currentValue.start,
        changes.selection.currentValue.end
      );
    }
  }

  scrollAndSelect(lineStart: number, lineEnd: number) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    const actualLineStart = lineStart - 1; // zero-based line index in CodeMirror
    const paddingTop = 1;
    const top = this.editor.instance.charCoords(
      { line: actualLineStart - paddingTop, ch: 0 },
      'local'
    ).top;
    this.editor.instance.setSelection(
      { line: lineEnd, ch: 0 },
      { line: actualLineStart, ch: 0 },
      { scroll: false }
    );
    this.editor.instance.scrollTo(null, top);

    this.timeoutId = setTimeout(() => {
      this.editor.instance.setCursor({ line: actualLineStart, ch: 0 });
      this.timeoutId = null;
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }
}
