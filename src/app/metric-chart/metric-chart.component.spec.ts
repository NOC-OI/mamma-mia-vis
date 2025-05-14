import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetricChartComponent } from './metric-chart.component';

describe('MetricChartComponent', () => {
  let component: MetricChartComponent;
  let fixture: ComponentFixture<MetricChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetricChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MetricChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
