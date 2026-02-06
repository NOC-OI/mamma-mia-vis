import { Component, Input, OnInit, ViewChild, ElementRef, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';
import { MetricsUnits, MetricsPage, SensorsReadings, SeriesPoint } from '../../services/campaign.interface';
import { CampaignService } from '../../services/campaign.service';
import { Library } from '@observablehq/stdlib';
import { ChartLegendComponent } from '../chart-legend/chart-legend.component';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [ChartLegendComponent],
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.scss'
})
export class LineChartComponent implements OnChanges, AfterViewInit{
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  @Input() selectedMission = "";
  @Input() selectedDeployment = "";
  @Input() numberOfRecords = 50;
  @Input() variableName = "";
  @Input() startDate = "";
  @Input() endDate = "";
  @Input() title = "";
  @Input() invertYaxis = false;

  metricsUnits: MetricsUnits = {
    temperature: '°C',
    pressure: 'bar',
    conductivity: 'mS/cm',
    salinity: '',
    chlorophyll: '',
  };

  errorMessage: string | null = null;
  PAGE_NUMBER = 1;
  metricsData: MetricsPage = { metrics: [], totalRecords: 0, currentPage: 1, recordsPerPage: this.numberOfRecords };
  voronoi = false;
  colorScale: d3.ScaleSequential<string, never> | undefined;
  
  constructor(private campaignService: CampaignService){

  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes['selectedMission'] || changes['selectedDeployment'] || changes['numberOfRecords'] || changes['variableName'] 
      || changes['title'] || changes['startDate'] || changes['endDate'] || changes['invertYAxis']){
        this.selectedMission = !this.selectedMission ? changes['selectedMission']?.currentValue : this.selectedMission;
        this.selectedDeployment = !this.selectedDeployment ?  changes['selectedDeployment']?.currentValue : this.selectedDeployment;
        this.numberOfRecords = !this.numberOfRecords ?  changes['numberOfRecords']?.currentValue : this.numberOfRecords;
        this.variableName = !this.variableName ? changes['variableName']?.currentValue : this.variableName;
        this.title = !this.title ? changes['title']?.currentValue : this.title;
        this.startDate = !this.startDate ? changes['startDate']?.currentValue : this.startDate;
        this.endDate = !this.endDate ? changes['endDate']?.currentValue : this.endDate;
        this.invertYaxis = !this.invertYaxis ? changes['inverYAxis']?.currentValue : this.invertYaxis;
        this.getMetricsUnits();
        this.getMetricsData();
    }
    if (changes['metrics'] && this.metricsData.metrics.length > 0) {
      this.createChart(this.variableName);
    }
  }

  ngAfterViewInit(): void {
    this.getMetricsUnits();
    this.getMetricsData();
  }

  getMetricsUnits() {
    if (this.selectedMission == "rapidArray" || (this.selectedMission == "bioCarbon" && this.selectedDeployment)){
      this.campaignService.getMetricsUnits(this.selectedMission, this.selectedDeployment).subscribe({
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
  }

  getMetricsData() {
    if (this.selectedMission == "rapidArray" || (this.selectedMission == "bioCarbon" && this.selectedDeployment)){
          if(this.numberOfRecords > 0){
            this.campaignService.getMetricsData(this.selectedMission, this.selectedDeployment, this.startDate, this.endDate, this.PAGE_NUMBER, this.numberOfRecords).subscribe({
              next: (data) => {
                this.metricsData = data;
                this.metricsData.metrics.forEach(metricsReading => {
                  if (typeof metricsReading.datetime === 'number') {
                      metricsReading.datetime = new Date(metricsReading.datetime).toISOString();
                  }
                });
                this.errorMessage = null;
                this.createChart(this.variableName);
              },
              error: (error) => {
                this.errorMessage = error.message;
                console.error('Error fetching metrics data:', error);
              }
            });
          }          
    }
  }
  
  private createChart(metricName: string): void {
    if (!this.chartContainer || !metricName || !this.metricsData) return;

    const width = 928;
    const height = 550;
    const margin = { top: 20, right: 20, bottom: 30, left: 30 };

    // 1. Transform Data
    const formattedData: SeriesPoint[] = [];
    this.metricsData.metrics.forEach(d => {
      const date = new Date(d.datetime);
      const depth = d.depth;
      const val = d[metricName as keyof SensorsReadings];
      if (typeof val === 'number') {
        formattedData.push({ date, depth: depth, value: val, metric: metricName });
      }
    });

    if (formattedData.length === 0) return;

    // 2. Color Scale Update
    // We get all possible keys from your units object to ensure 
    // each variable consistently gets its own color across instances.
    const allMetrics = Object.keys(this.metricsUnits);
    
    // const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
    //   .domain(allMetrics);
    
    // const selectedColor = colorScale(metricName);

    // 3. Scales
    const xExtent = d3.extent(formattedData, d => d.date);
    const x = d3.scaleTime()
      .domain(xExtent as [Date, Date])
      .range([margin.left, width - margin.right]);

    const yExtent = d3.extent(formattedData, d => d.value);
    const yRange = this.invertYaxis ? [margin.top, height - margin.bottom] : [height - margin.bottom, margin.top]
    const y = d3.scaleLinear()
      .domain([yExtent[0] ?? 0, yExtent[1] ?? 0]).nice()
      .range(yRange);

    const yExtentDepth = d3.extent(formattedData, d=> d.depth);
    const yDepth = d3.scaleLinear()
      .domain([yExtentDepth[0] ?? 0, yExtentDepth[1] ?? 0]).nice()
      .range([height - margin.bottom, margin.top]);

    const lineColour = d3.scaleSequential(yDepth.domain(), d3.interpolateTurbo);    

    const chartHost = this.chartContainer.nativeElement;
    
    d3.select(chartHost).selectAll("svg").remove();
    
    this.colorScale = d3.scaleSequential(d3.interpolateTurbo).domain(yDepth.domain());
    

    //Selecting canvas of time series
    const svg = d3.select(chartHost).append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; overflow: visible; font: 10px sans-serif;");

    // 4. Axes
    const unit = this.metricsUnits[metricName as keyof MetricsUnits];
    
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      // .call(d3.axisBottom(x).ticks(d3.timeHour).tickFormat(d3.timeFormat("%d/%m/%y %H:%M") as any))
      .call(d3.axisBottom(x).ticks(d3.timeDay))
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end");

    const metricLabelPosition = this.invertYaxis ? ".tick:first-of-type text" : ".tick:last-of-type text";
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickFormat(d3.format(".2f")))
      .call(g => g.select(".domain").remove())
      .call(g => g.select(metricLabelPosition).clone()
        .attr("x", 3)
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text(`${metricName} (${unit})`)
      );

    // 5. Line generation
    const line = d3.line<SeriesPoint>()
      .x(d => x(d.date)!)
      .y(d => y(d.value)!);

    // Append the color gradient
    const gradientId = `gradient-${metricName}`;

    svg.append("linearGradient")
        .attr("id", gradientId)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", 0)
        .attr("y2", 0)
      .selectAll("stop")
        .data(formattedData)
        .join("stop")
        .attr("offset", d => `${((x(d.date) - margin.left) / (width - margin.left - margin.right)) * 100}%`)
        .attr("stop-color", d => lineColour(d.depth));
    
    // 6. Draw Line with unique color
    svg.append("path")
      .datum(formattedData)
      .attr("fill", "none")
      .attr("stroke", `url(#${gradientId})`)
      .attr("stroke-width", 2)
      .attr("stroke-linejoin", "round")
      .attr("d", line);
    
    // 7. Create the grid.
    svg.append("g")
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.1)
        .call(g => g.append("g")
          .selectAll("line")
          .data(x.ticks())
          .join("line")
            .attr("x1", d => 0.5 + x(d))
            .attr("x2", d => 0.5 + x(d))
            .attr("y1", margin.top)
            .attr("y2", height - margin.bottom))
        .call(g => g.append("g")
          .selectAll("line")
          .data(y.ticks())
          .join("line")
            .attr("y1", d => 0.5 + y(d))
            .attr("y2", d => 0.5 + y(d))
            .attr("x1", margin.left)
            .attr("x2", width - margin.right));


    // 8. Interactivity
    const dot = svg.append("g").attr("display", "none");
    dot.append("circle")
      .attr("r", 4)
      // .attr("fill", selectedColor) // Dot color matches the line
      .attr("fill", `url(#${gradientId})`) // Dot color matches the line
      .attr("stroke", "white")
      .attr("stroke-width", 1);

    const dotLabel = dot.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -12)
      .style("font-weight", "bold")
      .style("fill", "#333");

    const pointermoved = (event: any) => {
      const [xm] = d3.pointer(event);
      const bisect = d3.bisector((d: SeriesPoint) => d.date).center;
      const i = bisect(formattedData, x.invert(xm));
      const d = formattedData[i];

      if (d) {
        dot.select("circle").attr("fill", lineColour(d.depth));
        dot.attr("transform", `translate(${x(d.date)},${y(d.value)})`);
        dotLabel.text(`${d.value.toFixed(2)} ${unit}`);
        dot.attr("display", null);
      }
    };

    svg
      .on("pointerenter", () => dot.attr("display", null))
      .on("pointermove", pointermoved)
      .on("pointerleave", () => dot.attr("display", "none"));
  }

  roundTo2Decimals( input?: number) {
    let roundedInput = input ? Math.round(input * 100) / 100 : undefined;
    return roundedInput;
  }

}
