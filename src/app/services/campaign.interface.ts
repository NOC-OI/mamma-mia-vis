export interface TrajectoryData {
  trajectory: StepData[]
}

export interface StepData {
  datetime: string,
  latitude: number,
  longitude: number,
  depth: number
}

export interface MetricsData {
  metrics: SensorsReadings[]
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