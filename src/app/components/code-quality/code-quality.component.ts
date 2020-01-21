import { Component, Input, OnInit } from '@angular/core';
import { NodeSelection } from '../../interfaces';

@Component({
  selector: 'app-code-quality',
  templateUrl: './code-quality.component.html',
  styleUrls: ['./code-quality.component.scss']
})
export class CodeQualityComponent implements OnInit {
  @Input() selectedNode: NodeSelection;

  constructor() {}

  ngOnInit() {}
}
