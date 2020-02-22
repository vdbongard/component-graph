import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-icon-description',
  templateUrl: './icon-description.component.html',
  styleUrls: ['./icon-description.component.scss']
})
export class IconDescriptionComponent implements OnInit {
  @Input() icon: string;
  @Input() description: string;

  constructor() {}

  ngOnInit(): void {}
}
