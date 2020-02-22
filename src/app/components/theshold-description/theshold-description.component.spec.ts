import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ThesholdDescriptionComponent } from './theshold-description.component';

describe('ThesholdDescriptionComponent', () => {
  let component: ThesholdDescriptionComponent;
  let fixture: ComponentFixture<ThesholdDescriptionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ThesholdDescriptionComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ThesholdDescriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
