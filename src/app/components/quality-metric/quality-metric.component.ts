import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-quality-metric',
  templateUrl: './quality-metric.component.html',
  styleUrls: ['./quality-metric.component.scss']
})
export class QualityMetricComponent implements OnInit {
  @Input() name;
  @Input() threshold;
  @Input() value;

  constructor() {}

  ngOnInit() {}
}
