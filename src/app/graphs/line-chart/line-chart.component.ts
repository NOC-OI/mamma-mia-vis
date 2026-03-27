import { Component, Input, OnInit, ViewChild, ElementRef, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';
import { MetricsUnits, MetricsPage, SensorsReadings, SeriesPoint, Margin } from '../../services/campaign.interface';
import { CampaignService } from '../../services/campaign.service';
import { ChartLegendComponent } from '../chart-legend/chart-legend.component';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [ChartLegendComponent],
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.scss'
})
export class LineChartComponent implements OnChanges, AfterViewInit {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  @Input() selectedMission = "";
  @Input() selectedDeployment = "";
  @Input() variableName = "";
  @Input() startDate = "";
  @Input() endDate = "";
  @Input() title = "";
  @Input() invertYaxis = false;
  @Input() minOffset = 0;
  @Input() maxOffset = 0;

  metricsUnits: MetricsUnits = {
    temperature: '°C',
    pressure: 'bar',
    conductivity: 'mS/cm',
    salinity: '',
    chlorophyll: '',
  };

  containerSize = { width: 928, height: 600 };
  errorMessage: string | null = null;
  PAGE_NUMBER = 1;
  metricsData: MetricsPage = { metrics: [], totalRecords: 0 };
  voronoi = false;
  colorScale: d3.ScaleSequential<string, never> | undefined;
  chartLegendTitle? = "";
  alertMessage = "";
  gradientColours = [
    { metric: "salinity", gradient: d3.interpolateViridis },
    { metric: "temperature", gradient: d3.interpolateTurbo },
    { metric: "chlorophyll", gradient: d3.interpolateGreens }
  ];
  min: number | undefined;
  max: number | undefined;
  private margin: Margin = { top: 20, right: 20, bottom: 30, left: 30 };
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private zoom: any;
  private currentXScale: any;

  constructor(private campaignService: CampaignService) {

  }

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['selectedMission']) this.selectedMission = changes['selectedMission'].currentValue;
    if (changes['selectedDeployment']) this.selectedDeployment = changes['selectedDeployment'].currentValue;
    if (changes['variableName']) this.variableName = changes['variableName'].currentValue;
    if (changes['title']) this.title = changes['title'].currentValue;
    if (changes['startDate']) this.startDate = changes['startDate'].currentValue;
    if (changes['endDate']) this.endDate = changes['endDate'].currentValue;
    if (changes['invertYaxis']) this.invertYaxis = changes['invertYaxis'].currentValue;

    if (this.selectedMission && this.startDate && this.endDate) {
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
    if (this.selectedMission == "rapidArray" || (this.selectedMission == "bioCarbon" && this.selectedDeployment)) {
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
    if (this.selectedMission == "rapidArray" || (this.selectedMission == "bioCarbon" && this.selectedDeployment)) {
      this.campaignService.getMetricsData(this.selectedMission, this.selectedDeployment, this.startDate, this.endDate).subscribe({
        next: (data) => {
          this.metricsData = data;
          this.metricsData.metrics.forEach(metricsReading => {
            if (typeof metricsReading.datetime === 'number') {
              metricsReading.datetime = new Date(metricsReading.datetime).toISOString();
            }
          });
          this.errorMessage = null;
          const formattedData = this.getSensorReadingsData(this.variableName);
          this.calculateVariableBound(formattedData);
          this.createChart(this.variableName);
        },
        error: (error) => {
          this.errorMessage = error.message;
          console.error('Error fetching metrics data:', error);
        }
      });
    }
  }

  private calculateVariableBound(data: SeriesPoint[]): void {
    const values = data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length > 0) {
      let min = Math.min(...values) + this.minOffset;
      let max = Math.max(...values) + this.maxOffset;
      this.min = this.min !== undefined ? this.min : min;
      this.max = this.max !== undefined ? this.max : max;
    }
  }

  private createChart(metricName: string): void {
    this.alertMessage = "";
    if (!this.chartContainer || !metricName || !this.metricsData) {
      this.alertMessage = "An error was found when displaying time-series."
      return;
    }

    const formattedData: SeriesPoint[] = this.getSensorReadingsData(metricName);

    if (formattedData.length === 0) {
      this.alertMessage = "Data was not found, please select a different range of dates."
      return;
    }

    const { xMetric: xMetric, xDate, yDepth } = this.getScales(formattedData, this.margin);
    this.currentXScale = xDate; // Keep track of the zoomed scale

    const gradientColour = this.gradientColours.find((item) => item.metric == this.variableName);
    const lineColour = d3.scaleSequential(xMetric.domain(), gradientColour ? gradientColour.gradient : d3.interpolateTurbo);
    this.setZoomEvent(xDate, yDepth, formattedData, metricName, lineColour);
    const unit = this.createTimeSeriesCanvas(gradientColour, xMetric, metricName, this.margin, xDate, yDepth);
    const gradientId = this.createGradientColourLine(xDate, yDepth, metricName, this.svg, this.margin, formattedData, lineColour);
    this.createGrid(this.svg, xDate, this.margin, yDepth);
    this.displayDotLabelOverLine(this.svg, gradientId, formattedData, xDate, lineColour, yDepth, unit);
    this.svg.call(this.zoom);
  }

  private setZoomEvent(xDate: d3.ScaleTime<number, number, never>, yDepth: d3.ScaleLinear<number, number, never>, formattedData: SeriesPoint[], metricName: string, lineColour: d3.ScaleSequential<string, never>) {
    this.zoom = d3.zoom()
      .scaleExtent([1, 10]) // Limit zoom level
      .extent([[this.margin.left, 0], [this.containerSize.width - this.margin.right, this.containerSize.height]])
      .translateExtent([[this.margin.left, -Infinity], [this.containerSize.width - this.margin.right, Infinity]])
      .on("zoom", (event) => this.zoomed(event, xDate, yDepth, formattedData, metricName, lineColour));
  }

  private zoomed(event: any, xDate: any, yDepth: any, data: any[], metricName: string, lineColour: any) {
    // 1. Create new scale based on zoom transform
    const newX = event.transform.rescaleX(xDate);
    this.currentXScale = newX;

    // 2. Update the X-axis
    (this.svg.select(".x-axis") as d3.Selection<SVGGElement, unknown, null, undefined>)
      .call(d3.axisBottom(newX).ticks(d3.timeDay))
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end");

    // 3. Update the Line path
    const line = d3.line<SeriesPoint>()
      .x(d => newX(d.date)!)
      .y(d => yDepth(d.depth)!);

    (this.svg.select(".main-line") as d3.Selection<SVGPathElement, SeriesPoint[], null, undefined>)
      .attr("d", line);

    // 4. Update Grid
    this.svg.select(".grid-x")
      .selectAll("line")
      .data(newX.ticks())
      .join("line")
      .attr("x1", (d: any) => newX(d))
      .attr("x2", (d: any) => newX(d));

    // 5. Update Gradient Position
    this.updateGradient(newX, metricName);
  }

  private updateGradient(xAxis: any, metricName: string) {
    const totalWidth = this.containerSize.width - this.margin.left - this.margin.right;
    d3.select(`#gradient-${metricName}`)
      .selectAll("stop")
      .attr("offset", (d: any) => {
        const xPos = xAxis(d.date) - this.margin.left;
        return `${(xPos / totalWidth) * 100}%`;
      });
  }

  private getSensorReadingsData(metricName: string) {
    const formattedData: SeriesPoint[] = [];
    this.metricsData.metrics.forEach(d => {
      const date = new Date(d.datetime);
      const depth = d.depth;
      const val = d[metricName as keyof SensorsReadings];
      if (typeof val === 'number') {
        formattedData.push({ date, depth: depth, value: val, metric: metricName });
      }
    });
    return formattedData;
  }

  private getScales(formattedData: SeriesPoint[], margin: Margin) {
    const xDateExtent = d3.extent(formattedData, d => d.date);
    const xDate = d3.scaleTime()
      .domain(xDateExtent as [Date, Date])
      .range([margin.left, this.containerSize.width - margin.right]);

    const xExtentMetric = d3.extent(formattedData, d => d.value);
    const domainMin = this.min !== undefined ? this.min : (xExtentMetric[0] ?? 0);
    const domainMax = this.max !== undefined ? this.max : (xExtentMetric[1] ?? 0);

    const xMetric = d3.scaleLinear()
      .domain([domainMin, domainMax]).nice()
      .range([margin.left, this.containerSize.width - margin.right]);

    const yExtentDepth = d3.extent(formattedData, d => d.depth);
    const yRange = this.invertYaxis ? [margin.top, this.containerSize.height - margin.bottom] : [this.containerSize.height - margin.bottom, margin.top];
    const yDepth = d3.scaleLinear()
      .domain([yExtentDepth[0] ?? 0, yExtentDepth[1] ?? 0]).nice()
      .range(yRange);

    return { xMetric: xMetric, xDate, yDepth };
  }

  private createTimeSeriesCanvas(gradientColour: { metric: string; gradient: (t: number) => string; } | undefined, xMetric: d3.ScaleLinear<number, number, never>, metricName: string, margin: Margin, x: d3.ScaleTime<number, number, never>, yDepth: d3.ScaleLinear<number, number, never>) {
    const chartHost = this.chartContainer.nativeElement;

    d3.select(chartHost).selectAll("svg").remove();

    this.colorScale = d3.scaleSequential(gradientColour ? gradientColour.gradient : d3.interpolateTurbo).domain(xMetric.domain());

    this.svg = d3.select(chartHost).append("svg")
      .attr("width", this.containerSize.width)
      .attr("height", this.containerSize.height)
      .attr("viewBox", [0, 0, this.containerSize.width, this.containerSize.height])
      .attr("style", "max-width: 100%; height: auto; overflow: visible; font: 10px sans-serif; padding-top: 2rem;");

    const unit = this.metricsUnits[metricName as keyof MetricsUnits];
    this.chartLegendTitle = `${metricName} ${unit}`;

    this.svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${this.containerSize.height - margin.bottom})`)
      // .call(d3.axisBottom(x).ticks(d3.timeHour).tickFormat(d3.timeFormat("%d/%m/%y %H:%M") as any))
      .call(d3.axisBottom(x).ticks(d3.timeDay))
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end");

    this.svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yDepth).tickFormat(d3.format(".2f")))
      .call(g => g.select(".domain").remove())
      .call(g => g.append("text")
        .attr("x", -margin.left)
        .attr("y", -margin.top)
        .attr("fill", "black")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .style("font-size", "12px")
        .text("Depth (m)")
      );

    this.svg.append("rect")
      .attr("transform", `translate(${margin.left}, 0)`)
      .attr("width", this.containerSize.width - margin.left - margin.right)
      .attr("height", this.containerSize.height - margin.bottom)
      .attr("fill", "#4c3155ff");

    this.svg.append("defs").append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("x", margin.left)
      .attr("y", 0)
      .attr("width", this.containerSize.width - margin.left - margin.right)
      .attr("height", this.containerSize.height - margin.bottom);
    return unit;
  }

  private createGradientColourLine(xAxis: d3.ScaleTime<number, number, never>, yAxis: d3.ScaleLinear<number, number, never>, metricName: string, svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, margin: Margin, formattedData: SeriesPoint[], lineColour: d3.ScaleSequential<string, never>) {
    const line = d3.line<SeriesPoint>()
      .x(d => xAxis(d.date)!)
      .y(d => yAxis(d.depth)!);

    const gradientId = `gradient-${metricName}`;

    const totalWidth = this.containerSize.width - margin.left - margin.right;
    svg.append("linearGradient")
      .attr("id", gradientId)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", margin.left)
      .attr("x2", this.containerSize.width - margin.right)
      .attr("y1", 0)
      .attr("y2", 0)
      .selectAll("stop")
      .data(formattedData)
      .join("stop")
      .attr("offset", d => {
        const xPos = xAxis(d.date) - margin.left;
        return `${(xPos / totalWidth) * 100}%`;
      })
      .attr("stop-color", d => lineColour(d.value));

    // Draw Line with colour gradient
    svg.append("path")
      .datum(formattedData)
      .attr("clip-path", "url(#clip)")
      .attr("class", "main-line")
      .attr("fill", "none")
      .attr("stroke", `url(#${gradientId})`)
      .attr("stroke-width", 2)
      .attr("stroke-linejoin", "round")
      .attr("d", line);
    return gradientId;
  }

  private createGrid(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, x: d3.ScaleTime<number, number, never>, margin: Margin, yDepth: d3.ScaleLinear<number, number, never>) {
    svg.append("g")
      .attr("stroke", "white")
      .attr("stroke-opacity", 0.1)
      .call(g => g.append("g")
        .selectAll("line")
        .data(x.ticks())
        .join("line")
        .attr("x1", d => 0.5 + x(d))
        .attr("x2", d => 0.5 + x(d))
        .attr("y1", margin.top)
        .attr("y2", this.containerSize.height - margin.bottom))
      .call(g => g.append("g")
        .selectAll("line")
        .data(yDepth.ticks())
        .join("line")
        .attr("y1", d => 0.5 + yDepth(d))
        .attr("y2", d => 0.5 + yDepth(d))
        .attr("x1", margin.left)
        .attr("x2", this.containerSize.width - margin.right));
  }

  private displayDotLabelOverLine(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, gradientId: string, formattedData: SeriesPoint[], x: d3.ScaleTime<number, number, never>, lineColour: d3.ScaleSequential<string, never>, yDepth: d3.ScaleLinear<number, number, never>, unit: string) {
    const dot = svg.append("g").attr("display", "none");
    dot.append("circle")
      .attr("r", 4)
      .attr("fill", `url(#${gradientId})`)
      .attr("stroke", "white")
      .attr("stroke-width", 1);

    const dotLabel = dot.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -12)
      .style("font-weight", "bold")
      .style("fill", "white");

    const pointermoved = (event: any) => {
      const [xm] = d3.pointer(event);
      const bisect = d3.bisector((d: SeriesPoint) => d.date).center;
      const i = bisect(formattedData, this.currentXScale.invert(xm));
      const d = formattedData[i];

      if (d) {
        dot.select("circle").attr("fill", lineColour(d.value));
        dot.attr("transform", `translate(${this.currentXScale(d.date)},${yDepth(d.depth)})`);
        dotLabel.text(`${d.value.toFixed(2)} ${unit}`);
        dot.attr("display", null);
      }
    };

    svg
      .on("pointerenter", () => dot.attr("display", null))
      .on("pointermove", pointermoved)
      .on("pointerleave", () => dot.attr("display", "none"));
  }

  roundTo2Decimals(input?: number) {
    let roundedInput = input ? Math.round(input * 100) / 100 : undefined;
    return roundedInput;
  }

}
