import { Component, Input, OnInit } from '@angular/core';
import { warningThreshold } from '../../constants/quality-metrics';

@Component({
  selector: 'app-quality-metric',
  templateUrl: './quality-metric.component.html',
  styleUrls: ['./quality-metric.component.scss']
})
export class QualityMetricComponent implements OnInit {
  @Input() name;
  @Input() threshold;
  @Input() value;
  @Input() description;

  warningThreshold = warningThreshold;

  constructor() {}

  ngOnInit() {}
}
