enum HorizontalOrigin {
  CENTER = "CENTER",
  LEFT = "LEFT",
  RIGHT = "RIGHT"
}

enum VerticalOrigin {
  UP = "UP",
  BOTTOM = "BOTTOM",
  CENTER = "CENTER"
}

enum StyleFill {
  FILL = "FILL"
}

export interface TrajectoryData {
  trajectory: [ Document, Vehicle ],
  totalRecords: number,
  pageNumber: number,
  pageSize: number
}

export interface Document {
  id: string,
  version: number
}

export interface Vehicle {
  id: string,
  availability: string,
  billboard: Billboard,
  label: Label,
  path: Path,
  position: Position
}

export interface Billboard {
  eyeOffset: Cartesian3D,
  horizontalOrigin: string,
  image: string,
  pixelOffset: Cartesian2D,
  scale: number,
  show: ShowAtInterval,
  verticalOrigin: string
}

export interface Label {
  fillColor : ColorAtInterval[],
  font: string,
  horizontalOrigin: string,
  outlinedColor: RGBA,
  pixelOffset: Cartesian2D,
  scale: number,
  show: ShowAtInterval[],
  style: string,
  text: string,
  verticalOrigin: string
}

export interface Path {
  material: SolidColor,
  width: WidthAtInterval[],
  show: ShowAtInterval[]
}

export interface Position {
  interpolationAlgorithm: string,
  interpolationDegree: number,
  epoch: string,
  cartesian: number[]
}



export interface SolidColor { 
  solidColor : Color
}

export interface Color {
  color: ColorAtInterval
}

export interface Cartesian2D {
  cartesian2: number[]
}

export interface Cartesian3D {
  cartesian: number[]
}

export interface ShowAtInterval {
  interval: string,
  boolean: boolean
}

export interface ColorAtInterval {
  interval: string,
  rgba: number[]
}

export interface WidthAtInterval {
  interval: string,
  number: number
}

export interface RGBA {
  rgba: number[]
}


export interface StepData {
  datetime: string,
  latitude: number,
  longitude: number,
  depth: number
}

export interface MetricsPage {
  totalRecords: number;
  currentPage: number;
  recordsPerPage: number;
  metrics: SensorsReadings[];
}

export interface SensorsReadings {
  datetime: string,
  latitude: number,
  longitude: number,
  depth: number,
  nitrate?: number,
  conductivity?: number,
  temperature?: number,
  pressure?: number,
}

export interface MetricsUnits {
  conductivity: string,
  salinity: string,
  temperature: string,
  pressure: string,
  chlorophyll: string
}

export interface SeriesPoint {
  date: Date;
  depth: number;
  value: number;
  metric: string;
}