import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CodeQualityComponent } from './code-quality.component';

describe('CodeQualityComponent', () => {
  let component: CodeQualityComponent;
  let fixture: ComponentFixture<CodeQualityComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CodeQualityComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CodeQualityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
