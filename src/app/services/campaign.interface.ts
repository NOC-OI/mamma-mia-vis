export interface TrajectoryData {
  trajectory: StepData[]
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
  temperature: string,
  pressure: string,
}

export interface SeriesPoint {
  date: Date;
  value: number;
  metric: string;
}