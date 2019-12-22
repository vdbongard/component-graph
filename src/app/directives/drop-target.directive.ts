import {
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Output
} from '@angular/core';
import { getFilesAsync } from '../helper/getFilesAsyc';

@Directive({
  selector: '[appDropTarget]'
})
export class DropTargetDirective {
  el: ElementRef;

  @Output() fileDropped = new EventEmitter<any>();

  @HostBinding('class.is-dragging-over')
  public isDraggingOver = false;

  constructor(el: ElementRef) {
    this.el = el;
  }

  @HostListener('dragenter', ['$event'])
  dragEnter(event) {
    event.preventDefault();
    this.isDraggingOver = true;
  }

  @HostListener('dragover', ['$event'])
  dragOver(event) {
    event.preventDefault();
  }

  @HostListener('dragleave', ['$event'])
  dragLeave(event) {
    event.preventDefault();
    if (event.target === this.el.nativeElement) {
      this.isDraggingOver = false;
    }
  }

  @HostListener('drop', ['$event'])
  async drop(event) {
    event.preventDefault();
    this.isDraggingOver = false;

    if (event.dataTransfer.items.length === 0) {
      return;
    }

    const files = await getFilesAsync(event.dataTransfer);
    this.fileDropped.emit(files);
  }
}
