// Copyright 2021, Observable Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/color-legend

import { Component, ElementRef, Input, OnChanges, ViewChild, AfterViewInit, SimpleChanges } from '@angular/core';
import * as d3 from 'd3';

export interface LegendOptions {
  title?: string;
  tickSize?: number;
  width?: number;
  height?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  ticks?: number;
  tickFormat?: any;
  tickValues?: any[];
}

@Component({
  selector: 'app-chart-legend',
  standalone: true,
  templateUrl: './chart-legend.component.html',
  styleUrl: './chart-legend.component.scss'
})
export class ChartLegendComponent implements OnChanges, AfterViewInit {
  @ViewChild('legendContainer', { static: true }) container!: ElementRef;

  @Input() colorScale: any;
  @Input() options: LegendOptions = {};

  ngAfterViewInit() {
    this.renderLegend();
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['colorScale'] || changes['options']) && this.container) {
      this.renderLegend();
    }
  }

  private renderLegend() {
    if (!this.colorScale) return;

    // Default configuration
    const {
      title,
      tickSize = 6,
      width = 320,
      height = 44 + tickSize,
      marginTop = 18,
      marginRight = 0,
      marginBottom = 16 + tickSize,
      marginLeft = 0,
      ticks = width / 64,
      tickFormat,
      tickValues
    } = this.options;

    // Clear previous legend
    const host = d3.select(this.container.nativeElement);
    host.selectAll('*').remove();

    const svg = host.append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("overflow", "visible")
      .style("display", "block");

    let tickAdjust = (g: any) => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);
    let x: any;

    // Continuous Scale
    if (this.colorScale.interpolate) {
      const n = Math.min(this.colorScale.domain().length, this.colorScale.range().length);
      x = this.colorScale.copy().rangeRound(d3.quantize(d3.interpolate(marginLeft, width - marginRight), n));

      svg.append("image")
        .attr("x", marginLeft)
        .attr("y", marginTop)
        .attr("width", width - marginLeft - marginRight)
        .attr("height", height - marginTop - marginBottom)
        .attr("preserveAspectRatio", "none")
        .attr("xlink:href", this.ramp(this.colorScale.copy().domain(d3.quantize(d3.interpolate(0, 1), n))).toDataURL());
    }

    // Sequential Scale
    else if (this.colorScale.interpolator) {
      x = Object.assign(this.colorScale.copy()
        .interpolator(d3.interpolateRound(marginLeft, width - marginRight)),
        { range() { return [marginLeft, width - marginRight]; } });

      svg.append("image")
        .attr("x", marginLeft)
        .attr("y", marginTop)
        .attr("width", width - marginLeft - marginRight)
        .attr("height", height - marginTop - marginBottom)
        .attr("preserveAspectRatio", "none")
        .attr("xlink:href", this.ramp(this.colorScale.interpolator()).toDataURL());

      if (!x.ticks) {
        let v = tickValues;
        let f = tickFormat;
        if (v === undefined) {
          const n = Math.round(ticks + 1);
          v = d3.range(n).map(i => d3.quantile(this.colorScale.domain(), i / (n - 1)));
        }
        if (typeof f !== "function") {
          f = d3.format(f === undefined ? ",f" : f);
        }
        // Apply back to local scope for the axis call
        (this as any)._localTickValues = v;
        (this as any)._localTickFormat = f;
      }
    }

    // Threshold / Quantile / Quantize Scale
    else if (this.colorScale.invertExtent) {
      const thresholds = this.colorScale.thresholds ? this.colorScale.thresholds()
        : this.colorScale.quantiles ? this.colorScale.quantiles()
        : this.colorScale.domain();

      const thresholdFormat = tickFormat === undefined ? (d: any) => d
        : typeof tickFormat === "string" ? d3.format(tickFormat)
        : tickFormat;

      x = d3.scaleLinear()
        .domain([-1, this.colorScale.range().length - 1])
        .rangeRound([marginLeft, width - marginRight]);

      svg.append("g")
        .selectAll("rect")
        .data(this.colorScale.range())
        .join("rect")
        .attr("x", (d: any, i: number) => x(i - 1))
        .attr("y", marginTop)
        .attr("width", (d: any, i: number) => x(i) - x(i - 1))
        .attr("height", height - marginTop - marginBottom)
        .attr("fill", (d: any) => d);

      (this as any)._localTickValues = d3.range(thresholds.length);
      (this as any)._localTickFormat = (i: number) => thresholdFormat(thresholds[i], i);
    }

    // Ordinal Scale
    else {
      x = d3.scaleBand()
        .domain(this.colorScale.domain())
        .rangeRound([marginLeft, width - marginRight]);

      svg.append("g")
        .selectAll("rect")
        .data(this.colorScale.domain())
        .join("rect")
        .attr("x", x)
        .attr("y", marginTop)
        .attr("width", Math.max(0, x.bandwidth() - 1))
        .attr("height", height - marginTop - marginBottom)
        .attr("fill", this.colorScale);

      tickAdjust = () => { };
    }

    // Draw Axis
    svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x)
        .ticks(ticks, typeof tickFormat === "string" ? tickFormat : undefined)
        .tickFormat(typeof (this as any)._localTickFormat === "function" ? (this as any)._localTickFormat : (typeof tickFormat === "function" ? tickFormat : undefined))
        .tickSize(tickSize)
        .tickValues((this as any)._localTickValues || tickValues))
      .call(tickAdjust)
      .call(g => g.select(".domain").remove())
      .call(g => g.append("text")
        .attr("x", marginLeft)
        .attr("y", marginTop + marginBottom - height - 6)
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .attr("class", "title")
        .text(title || ""));
  }

  private ramp(color: any, n = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = 1;
    const context = canvas.getContext("2d")!;
    for (let i = 0; i < n; ++i) {
      context.fillStyle = color(i / (n - 1));
      context.fillRect(i, 0, 1, 1);
    }
    return canvas;
  }
}