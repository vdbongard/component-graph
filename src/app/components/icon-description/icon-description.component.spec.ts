import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { IconDescriptionComponent } from './icon-description.component';

describe('IconDescriptionComponent', () => {
  let component: IconDescriptionComponent;
  let fixture: ComponentFixture<IconDescriptionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [IconDescriptionComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IconDescriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
