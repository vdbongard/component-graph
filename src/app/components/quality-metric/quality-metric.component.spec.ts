import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { QualityMetricComponent } from './quality-metric.component';

describe('QualityMetricComponent', () => {
  let component: QualityMetricComponent;
  let fixture: ComponentFixture<QualityMetricComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [QualityMetricComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(QualityMetricComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
