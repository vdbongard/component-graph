import {
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Output
} from '@angular/core';

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
  drop(event) {
    event.preventDefault();
    this.isDraggingOver = false;
    this.onFileChange(event.dataTransfer.files);
  }

  onFileChange(files) {
    if (files.length === 0) {
      return;
    }

    console.log('File:', files[0]);
    this.fileDropped.emit(files[0]);
  }
}
