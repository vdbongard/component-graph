import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-upload-view',
  templateUrl: './upload-view.component.html',
  styleUrls: ['./upload-view.component.scss']
})
export class UploadViewComponent implements OnInit {
  isDraggingOver = false;

  constructor(private router: Router) {}

  ngOnInit() {}

  dragEnter(event) {
    event.preventDefault();
    this.isDraggingOver = true;
  }

  dragLeave(event) {
    event.preventDefault();
    this.isDraggingOver = false;
  }

  drop(event) {
    event.preventDefault();
    this.isDraggingOver = false;
    this.onFileChange(event.dataTransfer.files);
  }

  onFileChange(files) {
    if (files.length === 0) {
      return;
    }
    this.router.navigateByUrl('graph');
  }
}
