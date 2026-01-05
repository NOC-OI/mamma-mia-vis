import { Component, Input, OnInit, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import * as d3 from 'd3';
import { MetricsUnits, MetricsPage } from '../../services/campaign.interface';
import { CampaignService } from '../../services/campaign.service';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [],
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.scss'
})
export class LineChartComponent implements OnInit, OnChanges{
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  @Input() selectedMission = "";
  metricsUnits: MetricsUnits | null = null;
  errorMessage: string | null = null;
  PAGE_NUMBER = 1;
  RECORDS_PER_PAGE = 400;
  metricsData: MetricsPage = { metrics: [], totalRecords: 0, currentPage: 1, recordsPerPage: this.RECORDS_PER_PAGE };
  selectedDeployment = ""
  voronoi = false;
  
  constructor(private campaignService: CampaignService){

  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['metrics'] && this.metricsData.metrics.length > 0) {
      this.createChart();
    }
  }

  ngOnInit(): void {
    this.getMetricsUnits();
    this.getMetricsData();
  }

  getMetricsUnits() {
    this.campaignService.getMetricsUnits(this.selectedMission).subscribe({
      next: (data) => {
        this.metricsUnits = data;
        this.errorMessage = null;
      },
      error: (error) => {
        this.errorMessage = error.message;
        console.error('Error fetching metrics units: ', error)
      }
    });
  }

  getMetricsData() {

    this.campaignService.getMetricsData(this.selectedMission, this.selectedDeployment, this.PAGE_NUMBER, this.RECORDS_PER_PAGE).subscribe({
      next: (data) => {
        this.metricsData = data;
        this.metricsData.metrics.forEach(metricsReading => {
          if (typeof metricsReading.datetime === 'number') {
              metricsReading.datetime = new Date(metricsReading.datetime).toISOString();
          }
        });
        this.errorMessage = null;
        // this.addSensorReadingsToTimeSeries();
        this.createChart();
      },
      error: (error) => {
        this.errorMessage = error.message;
        console.error('Error fetching metrics data:', error);
      }
    });

  }
  
  private createChart(): void {
    // 1. Clear previous chart
    // const container = this.chartContainer.nativeElement;
    // d3.select(container).selectAll('*').remove();

    // 2. Dimensions
    const width = 928;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 30, left: 30 };

    // 3. Fix the "Iterable" error with type assertion/guards
    const xExtent = d3.extent(this.metricsData.metrics, d => new Date(d.datetime));
    if (!xExtent[0] || !xExtent[1]) return; 

    const x = d3.scaleTime()
      .domain(xExtent as [Date, Date]) // Cast after guard
      .range([margin.left, width - margin.right]);

    const yMax = d3.max(this.metricsData.metrics, d => d.depth) ?? 0;
    const y = d3.scaleLinear()
      .domain([0, yMax]).nice()
      .range([height - margin.bottom, margin.top]);

    // 4. SVG Container
    //   const svg = d3.select(container).append('svg')

    const svg = d3.select("app-line-chart").append('svg')
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; overflow: visible; font: 10px sans-serif;");

    // 5. Axes
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(width / 100).tickSizeOuter(0).tickFormat(d3.timeFormat("%d/%m/%y %H:%M") as any));

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select(".domain").remove())
      .call(this.voronoi ? () => {} : g => g.selectAll(".tick line").clone()
        .attr("x2", width - margin.left - margin.right)
        .attr("stroke-opacity", 0.1));

    // 6. Data Points ([x, y, label])
    // Assuming we group by 'latitude' or another field as the "series"
    const points: [number, number, string][] = this.metricsData.metrics.map(d => [
      x(new Date(d.datetime))!,
      y(d.depth)!,
      `${this.roundTo2Decimals(d.temperature)} ${this.metricsUnits?.temperature}` // Using temperature as the series identifier
    ]);

    // 7. Grouping
    const groups = d3.rollup(points, v => Object.assign(v, { z: v[0][2] }), d => d[2]);

    // 8. Drawing Lines
    const line = d3.line<[number, number, string]>()
      .x(d => d[0])
      .y(d => d[1]);

    const path = svg.append("g")
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(groups.values())
      .join("path")
      .attr("d", d => line(d as any)) // Explicit cast for d3.line
      .style("mix-blend-mode", "multiply");

    // 9. Interactivity (The "Dot")
    const dot = svg.append("g").attr("display", "none");
    dot.append("circle").attr("r", 2.5);
    dot.append("text").attr("text-anchor", "middle").attr("y", -8);

    // Event Handlers
    const pointermoved = (event: any) => {
      const [xm, ym] = d3.pointer(event);
      const i = d3.leastIndex(points, ([px, py]) => Math.hypot(px - xm, py - ym));
      if (i === undefined) return;

      const [px, py, k] = points[i];
      path.style("stroke", (d: any) => d.z === k ? null : "#ddd")
          .filter((d: any) => d.z === k).raise();
      
      dot.attr("transform", `translate(${px},${py})`);
      dot.select("text").text(k);
    };

    svg
      .on("pointerenter", () => {
        path.style("mix-blend-mode", null).style("stroke", "#ddd");
        dot.attr("display", null);
      })
      .on("pointermove", pointermoved)
      .on("pointerleave", () => {
        path.style("mix-blend-mode", "multiply").style("stroke", "steelblue");
        dot.attr("display", "none");
      })
      .on("touchstart", event => event.preventDefault());
  }

  roundTo2Decimals( input?: number) {
    let roundedInput = input ? Math.round(input * 100) / 100 : undefined;
    return roundedInput;
  }

}
