import { Component, Input, OnInit, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import * as d3 from 'd3';
import { MetricsUnits, MetricsPage, SensorsReadings, SeriesPoint } from '../../services/campaign.interface';
import { CampaignService } from '../../services/campaign.service';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [],
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.scss'
})
export class LineChartComponent implements OnInit, OnChanges{
  @Input() selectedMission = "";
  @Input() selectedDeployment = "";
  @Input() numberOfRecords = 50;

  metricsUnits: MetricsUnits = {
    temperature: '°C',
    pressure: 'bar',
    conductivity: 'mS/cm',
    salinity: '',
  };

  errorMessage: string | null = null;
  PAGE_NUMBER = 1;
  metricsData: MetricsPage = { metrics: [], totalRecords: 0, currentPage: 1, recordsPerPage: this.numberOfRecords };
  voronoi = false;
  
  constructor(private campaignService: CampaignService){

  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes['selectedMission'] || changes['selectedDeployment'] || changes['numberOfRecords']){
        this.selectedMission = !this.selectedMission ? changes['selectedMission']?.currentValue : this.selectedMission;
        this.selectedDeployment = !this.selectedDeployment ?  changes['selectedDeployment']?.currentValue : this.selectedDeployment;
        this.numberOfRecords = !this.numberOfRecords ?  changes['numberOfRecords']?.currentValue : this.numberOfRecords;
        this.getMetricsUnits();
        this.getMetricsData();
    }
    if (changes['metrics'] && this.metricsData.metrics.length > 0) {
      this.createChart();
    }
  }

  ngOnInit(): void {
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
            this.campaignService.getMetricsData(this.selectedMission, this.selectedDeployment, this.PAGE_NUMBER, this.numberOfRecords).subscribe({
              next: (data) => {
                this.metricsData = data;
                this.metricsData.metrics.forEach(metricsReading => {
                  if (typeof metricsReading.datetime === 'number') {
                      metricsReading.datetime = new Date(metricsReading.datetime).toISOString();
                  }
                });
                this.errorMessage = null;
                this.createChart();
              },
              error: (error) => {
                this.errorMessage = error.message;
                console.error('Error fetching metrics data:', error);
              }
            });
          }          
    }
  }
  
  private createChart(): void {
    const width = 928;
    const height = 550;
    const margin = { top: 20, right: 20, bottom: 30, left: 30 };

    // 1. Transform Data: Flatten multiple properties into individual series points
    // const metrics = ['temperature', 'pressure', 'conductivity'];
    const metrics = Object.keys(this.metricsUnits) as Array<keyof MetricsUnits>;
    const formattedData: SeriesPoint[] = [];
    
    this.metricsData.metrics.forEach(d => {
      const date = new Date(d.datetime);
      metrics.forEach(metric => {
        const val = d[metric as keyof SensorsReadings];
        if (typeof val === 'number') {
          formattedData.push({ date, value: val, metric });
        }
      });
    });

    // 2. Scales
    const xExtent = d3.extent(this.metricsData.metrics, d => new Date(d.datetime));
    if (!xExtent[0] || !xExtent[1]) return; 

    const x = d3.scaleTime()
      .domain(xExtent as [Date, Date])
      .range([margin.left, width - margin.right]);

    // Y scale must now cover the min/max of ALL metrics combined
    const yExtent = d3.extent(formattedData, d => d.value);
    const y = d3.scaleLinear()
      .domain([yExtent[0] ?? 0, yExtent[1] ?? 0]).nice()
      .range([height - margin.bottom, margin.top]);
    
    // Color scale for different lines
    const color = d3.scaleOrdinal(d3.schemeCategory10)
      .domain(metrics);

    // 3. SVG Container

    d3.select("app-line-chart").selectAll("svg").remove();

    const svg = d3.select("app-line-chart").append('svg')
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: 550px; overflow: visible; font: 10px sans-serif;");

    // 4. Axes
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(d3.timeHour).tickSizeOuter(0)
      .tickFormat(d3.timeFormat("%d/%m/%y %H:%M") as any))
      .selectAll("text")
      // .style("font-size", "9px")
      .style("fill", "#666")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")  // Horizontal offset
      .attr("dy", ".15em")  // Vertical offset
      .attr("transform", "rotate(-35)"); // Rotate 45 degrees counter-clockwise

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickFormat(d3.format(".2f")))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").clone()
      // .call(this.voronoi ? () => {} : g => g.selectAll(".tick line").clone()
        .attr("x2", width - margin.left - margin.right)
        .attr("stroke-opacity", 0.1))
      .call(g => g.select(".tick:last-of-type text").clone()
        .attr("x", 3)
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text("Depth (m)")
    )

    // 5. Group data by metric for line generation
    const groups = d3.group(formattedData, d => d.metric);

    const line = d3.line<SeriesPoint>()
      .x(d => x(d.date)!)
      .y(d => y(d.value)!);

    // 6. Draw Lines
    const path = svg.append("g")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .selectAll("path")
      .data(groups)
      .join("path")
      .attr("stroke", ([metric]) => color(metric))
      .attr("d", ([_, values]) => line(values))
      .style("mix-blend-mode", "multiply");

    // 7. Interactivity (The "Dot")
    const dot = svg.append("g").attr("display", "none");
    dot.append("circle").attr("r", 2.5);

    // Use 'dy' to give the text some breathing room above the point
    const dotLabel = dot.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -10)
      .style("font-weight", "bold");

    // Event Handlers
    const pointermoved = (event: any) => {
      const [xm, ym] = d3.pointer(event);
      // Find the single closest point among all series
      const i = d3.leastIndex(formattedData, d => Math.hypot(x(d.date)! - xm, y(d.value)! - ym));
      if (i === undefined) return;

      const d = formattedData[i];
      // Look up the unit using the metric key typed via MetricsUnits
      const unit = this.metricsUnits[d.metric as keyof MetricsUnits];

      // Update highlight: Fade others, emphasize current metric line
      path.style("stroke", ([metric]) => metric === d.metric ? color(metric) : "#ddd")
          .attr("stroke-width", ([metric]) => metric === d.metric ? 3 : 1)
          .filter(([metric]) => metric === d.metric).raise();
      
      dot.attr("transform", `translate(${x(d.date)},${y(d.value)})`);
      // dot.select("text").text(`${d.metric}: ${d.value.toFixed(2)}`);
      dot.select("circle").attr("stroke", color(d.metric));
      
      dotLabel.text(`${d.value.toFixed(2)} ${unit}`);
      dot.attr("display", null);
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
