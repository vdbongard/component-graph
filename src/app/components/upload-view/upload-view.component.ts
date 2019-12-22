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
    this.dataService.setFiles(event.target.files);
    this.router.navigate(['graph'], { queryParams: { text: 1, fade: 1 } });
  }
}
