import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-quality-metric',
  templateUrl: './quality-metric.component.html',
  styleUrls: ['./quality-metric.component.scss']
})
export class QualityMetricComponent implements OnInit {
  @Input() name;
  @Input() threshold;
  @Input() set value(value: number) {
    this.valueInternal = value;
    this.progressValue = (value / this.threshold) * 100;
  }
  get value(): number {
    return this.valueInternal;
  }

  private valueInternal: number;
  private progressValue: number;

  constructor() {}

  ngOnInit() {}
}
