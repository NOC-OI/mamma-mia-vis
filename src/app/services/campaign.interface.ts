export interface TrajectoryData {
  trajectory: StepData[]
}

export interface StepData {
  datetime: string,
  latitude: number,
  longitude: number,
  depth: number
}