import { Component, Input, OnInit } from '@angular/core';
import { qualityMetrics } from '../../constants/quality-metrics';
import { NodeSelection } from '../../interfaces';

@Component({
  selector: 'app-code-quality',
  templateUrl: './code-quality.component.html',
  styleUrls: ['./code-quality.component.scss']
})
export class CodeQualityComponent implements OnInit {
  @Input() set selectedNode(value: NodeSelection) {
    this.selectedNodeInternal = value;
    if (value && value.report) {
      this.report = value.report.aggregate ? value.report.aggregate : value.report;
      console.log('Report', this.report);
    } else {
      this.report = null;
    }
  }
  get selectedNode(): NodeSelection {
    return this.selectedNodeInternal;
  }

  private selectedNodeInternal: NodeSelection;
  report: any;
  qualityMetrics = qualityMetrics;
  Object = Object;

  constructor() {
    console.log(qualityMetrics);
  }

  ngOnInit() {}
}
