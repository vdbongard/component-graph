import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-source-code',
  templateUrl: './source-code.component.html',
  styleUrls: ['./source-code.component.scss']
})
export class SourceCodeComponent implements OnInit {
  @Input() code: string;

  constructor() {}

  ngOnInit() {}
}
