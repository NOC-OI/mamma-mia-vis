import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef, Input } from '@angular/core';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { Subscription } from 'rxjs';
import { AnimationStateService, AnimationFrameState } from '../services/animation-state.service'; // Adjust path
import { CampaignService } from '../services/campaign.service';
import { MetricsUnits } from '../services/campaign.interface';

@Component({
  selector: 'app-metric-chart',
  standalone: true,
  imports: [],
  templateUrl: './metric-chart.component.html',
  styleUrls: ['./metric-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush // Optimize change detection
})
export class MetricChartComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('metricCanvas') private metricCanvas!: ElementRef<HTMLCanvasElement>; // Use a unique ID/ref if needed
  @Input() selectedMission = "";
  metricsUnits: MetricsUnits | null = null;
  errorMessage: string | null = null;
  
  private chart: Chart | undefined;
  private stateSubscription: Subscription | undefined;
  private labels: String[] = [];
  private conductivityData: number[] = [];
  private temperatureData: number[] = [];


  // Chart configuration options
  private readonly MAX_DATA_POINTS = 60; // Limit history length

  constructor(
    private animationStateService: AnimationStateService,
    private campaignService: CampaignService,
    private cdr: ChangeDetectorRef // Inject ChangeDetectorRef for OnPush
  ) { }

  ngOnInit(): void {
    // Subscription logic moved to ngAfterViewInit AFTER chart is created
    this.getMetricsUnits();
  }

  ngAfterViewInit(): void {

  }

  ngOnDestroy(): void {
    this.cleanUpResources();
  }

  cleanUpResources(){
    // Unsubscribe to prevent memory leaks
    this.stateSubscription?.unsubscribe();
    // Destroy the chart instance
    this.chart?.destroy();
  }


  getMetricsUnits() {
    this.campaignService.getMetricsUnits(this.selectedMission).subscribe({
      next: (data) => {
        this.metricsUnits = data;
        this.createChart(); // Create the initial empty chart structure
        this.subscribeToState(); // Subscribe AFTER chart is initialized
        this.errorMessage = null;
      },
      error: (error) => {
        this.errorMessage = error.message;
        console.error('Error fetching metrics units: ', error)
      }
    });
  }

  createChart(): void {
    let delayed = false;
    if (!this.metricCanvas) {
      console.error("Canvas element 'metricCanvas' not found.");
      return;
    }
    const canvas = this.metricCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get 2D context from canvas element.");
      return;
    }

    this.chart = new Chart(ctx, {
      type: 'line', // Line chart
      data: {
        labels: this.labels, // Start with empty labels (will be timestamps)
        datasets: [
          // {
          //   label: 'Speed (m/s)', // Example metric
          //   data: [], // Start with empty data
          //   borderColor: 'rgb(75, 192, 192)',
          //   tension: 0.1, // Smooth lines
          //   pointRadius: 2,
          // },
          // {
          //   label: 'Depth (m)', // Example second metric
          //   data: [],
          //   borderColor: 'rgb(102,204,255)',
          //   tension: 0.1,
          //   pointRadius: 2,
          //   yAxisID: 'yAltitude' // Assign to a secondary axis if scales differ greatly
          // },
          { 
            label: `Conductivity ( ${this.metricsUnits?.conductivity})`,
            data: this.conductivityData,
            borderColor: 'rgba(83, 64, 255, 1)', // Example Orange color
            cubicInterpolationMode: 'monotone',
            tension: 0.1,
            pointRadius: 2,
            yAxisID: 'yConductivity' // <-- Assign to a new Conductivity axis
          },
          { 
            label: `Temperature (${this.metricsUnits?.temperature})`,
            data: this.temperatureData,
            borderColor: 'rgb(204,51,0)',
            tension: 0.1,
            pointRadius: 2,
            yAxisID: 'yTemperature'
          },
          // {
          //   label: `Pressure (${this.metricsUnits?.pressure})`,
          //   data: this.pressureData,
          //   borderColor: 'rgb(0,51,102)',
          //   tension: 0.1,
          //   pointRadius: 2,
          //   yAxisID: 'yPressure'
          // }
        ]
      },
      options: {
        animation: false, 
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time', // Use time scale
            time: {
              unit: 'second', // Adjust time unit as needed
              tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
              displayFormats: {
                 minute: 'HH:mm:ss'  
              }
            },
            ticks: {
              stepSize: 1
            },
            title: {
              display: true,
              text: 'Time'
            }
          },
          // y: { // Primary Y-axis (e.g., for Speed)
          //   beginAtZero: true,
          //   title: {
          //     display: true,
          //     text: 'Speed (m/s)'
          //   }
          // },
          // yAltitude: { // Secondary Y-axis (for Depth)
          //     position: 'right', // Position on the right
          //     beginAtZero: false, // Altitude might not start at 0
          //     title: {
          //         display: true,
          //         text: 'Depth (m)'
          //     },
          //     grid: {
          //         drawOnChartArea: false, // Only draw grid for primary axis or adjust as needed
          //     },
          // },
          yConductivity: { // <-- ADD Axis for Conductivity
            type: 'linear',
            display: true,
            position: 'left', // Or 'left' if preferred
            beginAtZero: false, // Adjust if conductivity can be negative or always starts at 0
            title: { display: true, text: `Conductivity ( ${this.metricsUnits?.conductivity})` }, // Adjust unit
            grid: { drawOnChartArea: false }, // Don't draw grid lines
            // Offset this axis slightly if it overlaps with Altitude axis label
            // ticks: { padding: 10 } // Example padding
          },
          yTemperature: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: false,
            title: { display: true, text: `Temperature (${this.metricsUnits?.temperature})` },
            grid: { drawOnChartArea: false }
          },
          // yPressure: {
          //   type: 'linear',
          //   display: true,
          //   position: 'right',
          //   beginAtZero: false,
          //   title: {display:true, text: `Pres. (${this.metricsUnits?.pressure})`}
          // }
        },
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          }
        }
      }
    });
    this.cdr.detectChanges(); // Trigger change detection once chart is created
  }

  subscribeToState(): void {
    this.stateSubscription = this.animationStateService.animationState$
      // Optional: Add throttling if updates are too frequent
      // .pipe(throttleTime(100, asyncScheduler, { leading: true, trailing: true }))
      .subscribe((state: AnimationFrameState) => {
        if (this.chart && state.times) { // Ensure chart exists and we have a valid time
          this.updateChartData(state);
        }
      });
  }

  updateChartData(state: AnimationFrameState): void {
    if (!this.chart || !this.chart.data.labels || !this.chart.data.datasets || !state.times) {
      return; // Safety check
    }

    this.labels = this.chart.data.labels as String[]; // Use number (timestamp) or Date
    this.conductivityData = this.chart.data.datasets[0].data as number[];
    this.temperatureData = this.chart.data.datasets[1].data  as number[];
 
    // Add new data point
    // labels.push(state.times.getTime()); // Use timestamp for x-axis
    // // speedData.push(state.speed ?? NaN); // Use NaN for missing data points
    // altitudeData.push(state.altitude ?? NaN);
    // conductivityData.push(state.conductivityLevels ?? NaN); 
    // temperatureData.push(state.temperatures ?? NaN);
    // // pressureData.push(state.pressure ?? NaN);
    this.chart.data.labels = this.labels.concat(state.times);
    // labels = labels.slice(0, 10);
    if(state.conductivityLevels){
      this.chart.data.datasets[0].data = this.conductivityData.concat(state.conductivityLevels);
    }
    if(state.temperatures){
      this.chart.data.datasets[1].data = this.temperatureData.concat(state.temperatures);
      // temperatureData = temperatureData.slice(0, 10);
    }
    if(state.pressures){
      // pressureData = this.pressureData.concat(state.pressures);
      // console.log(' Pressure data: ', this.pressureData);
    }
    

    // Limit the number of data points shown
    // if (labels.length > this.MAX_DATA_POINTS) {
    //   labels.shift(); // Remove oldest label
    //   // speedData.shift(); // Remove oldest speed data
    //   // altitudeData.shift(); // Remove oldest altitude data
    //   conductivityData.shift();
    //   temperatureData.shift();
    //   // this.pressureData.shift();
    // }

    // Update the chart without animation for performance
    this.chart.update('none');
     // No need for manual detectChanges here usually, as chart.update triggers redraw.
     // If issues persist with OnPush, you might need this.cdr.detectChanges();
  }
}