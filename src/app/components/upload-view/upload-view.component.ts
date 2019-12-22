import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-upload-view',
  templateUrl: './upload-view.component.html',
  styleUrls: ['./upload-view.component.scss']
})
export class UploadViewComponent implements OnInit {
  constructor(private router: Router, private dataService: DataService) {}

  ngOnInit() {}

  onFileChange(event) {
    const files = [];
    for (const file of event.target.files) {
      files.push({ file, path: '/' + file.webkitRelativePath });
    }

    this.dataService.setFiles(files);
    this.router.navigate(['graph'], { queryParams: { text: 1, fade: 1 } });
  }
}
