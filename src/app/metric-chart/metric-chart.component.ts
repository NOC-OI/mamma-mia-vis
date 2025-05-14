import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { Subscription } from 'rxjs';
import { AnimationStateService, AnimationFrameState } from '../services/animation-state.service'; // Adjust path

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
  private chart: Chart | undefined;
  private stateSubscription: Subscription | undefined;

  // Chart configuration options
  private readonly MAX_DATA_POINTS = 60; // Limit history length

  constructor(
    private animationStateService: AnimationStateService,
    private cdr: ChangeDetectorRef // Inject ChangeDetectorRef for OnPush
  ) { }

  ngOnInit(): void {
    // Subscription logic moved to ngAfterViewInit AFTER chart is created
  }

  ngAfterViewInit(): void {
    this.createChart(); // Create the initial empty chart structure
    this.subscribeToState(); // Subscribe AFTER chart is initialized
  }

  ngOnDestroy(): void {
    // Unsubscribe to prevent memory leaks
    this.stateSubscription?.unsubscribe();
    // Destroy the chart instance
    this.chart?.destroy();
  }

  createChart(): void {
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
      type: 'line', // Example: line chart
      data: {
        labels: [], // Start with empty labels (will be timestamps)
        datasets: [
          // {
          //   label: 'Speed (m/s)', // Example metric
          //   data: [], // Start with empty data
          //   borderColor: 'rgb(75, 192, 192)',
          //   tension: 0.1, // Smooth lines
          //   pointRadius: 2,
          // },
          {
            label: 'Depth (m)', // Example second metric
            data: [],
            borderColor: 'rgb(42,84,133)',
            tension: 0.1,
            pointRadius: 2,
            yAxisID: 'yAltitude' // Assign to a secondary axis if scales differ greatly
          },
          { 
            label: 'Nitrate (µmol/L)',
            data: [],
            borderColor: 'rgb(255, 159, 64)', // Example Orange color
            tension: 0.1,
            pointRadius: 2,
            yAxisID: 'yNitrate' // <-- Assign to a new Nitrate axis
          }
        ]
      },
      options: {
        animation: false, // Disable default Chart.js animation for smoother updates
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time', // Use time scale
            time: {
              unit: 'second', // Adjust time unit as needed
              tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
              displayFormats: {
                 second: 'HH:mm:ss'  
              }
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
          yAltitude: { // Secondary Y-axis (for Depth)
              position: 'right', // Position on the right
              beginAtZero: false, // Altitude might not start at 0
              title: {
                  display: true,
                  text: 'Depth (m)'
              },
              grid: {
                  drawOnChartArea: false, // Only draw grid for primary axis or adjust as needed
              },
          },
          yNitrate: { // <-- ADD Axis for Nitrate
            type: 'linear',
            display: true,
            position: 'right', // Or 'left' if preferred
            beginAtZero: false, // Adjust if nitrate can be negative or always starts at 0
            title: { display: true, text: 'Nitrate (µmol/L)' }, // Adjust unit
            grid: { drawOnChartArea: false }, // Don't draw grid lines
            // Offset this axis slightly if it overlaps with Altitude axis label
            // ticks: { padding: 10 } // Example padding
          }
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
        if (this.chart && state.currentTime) { // Ensure chart exists and we have a valid time
          this.updateChartData(state);
        }
      });
  }

  updateChartData(state: AnimationFrameState): void {
    if (!this.chart || !this.chart.data.labels || !this.chart.data.datasets || !state.currentTime) {
      return; // Safety check
    }

    const labels = this.chart.data.labels as number[]; // Use number (timestamp) or Date
    // const speedData = this.chart.data.datasets[0].data as number[];
    const altitudeData = this.chart.data.datasets[0].data as number[];
    const nitrateData = this.chart.data.datasets[1].data as number[];

    // Add new data point
    labels.push(state.currentTime.getTime()); // Use timestamp for x-axis
    // speedData.push(state.speed ?? NaN); // Use NaN for missing data points
    altitudeData.push(state.altitude ?? NaN);
    nitrateData.push(state.nitrate ?? NaN); 

    // Limit the number of data points shown
    if (labels.length > this.MAX_DATA_POINTS) {
      labels.shift(); // Remove oldest label
      // speedData.shift(); // Remove oldest speed data
      altitudeData.shift(); // Remove oldest altitude data
      nitrateData.shift();
    }

    // Update the chart without animation for performance
    this.chart.update('none');
     // No need for manual detectChanges here usually, as chart.update triggers redraw.
     // If issues persist with OnPush, you might need this.cdr.detectChanges();
  }
}