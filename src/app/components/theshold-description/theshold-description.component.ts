import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-theshold-description',
  templateUrl: './theshold-description.component.html',
  styleUrls: ['./theshold-description.component.scss']
})
export class ThesholdDescriptionComponent implements OnInit {
  @Input() icon: string;

  constructor() {}

  ngOnInit(): void {}
}
