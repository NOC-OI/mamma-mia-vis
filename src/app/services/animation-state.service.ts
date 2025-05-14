import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { JulianDate, Cartesian3 } from 'cesium'; // Assuming Cesium types are globally available or imported

// Define an interface for the state we want to share
export interface AnimationFrameState {
  currentTime: Date | null; // Use standard Date for easier consumption
  position: { x: number; y: number; z: number } | null; // Simplified position
  velocity: { x: number; y: number; z: number } | null; // Simplified velocity
  speed: number | null; // Calculated speed
  // Add any other metrics your chart might need (e.g., altitude, distance)
  altitude: number | null;
  distance: number | null;
  nitrate: number | null;
}

@Injectable({
  providedIn: 'root' // Make the service a singleton available app-wide
})
export class AnimationStateService {

  // Use BehaviorSubject to hold the latest state and emit it to new subscribers
  private animationStateSubject = new BehaviorSubject<AnimationFrameState>({
    currentTime: null,
    position: null,
    velocity: null,
    speed: null,
    altitude: null,
    distance: null,
    nitrate: null,
  });

  // Expose the state as an Observable for components to subscribe to
  public animationState$: Observable<AnimationFrameState> = this.animationStateSubject.asObservable();

  constructor() { }

  // Method for the Cesium component to call to update the state
  updateState(
    cesiumTime: JulianDate,
    position: Cartesian3 | undefined,
    velocity: Cartesian3 | undefined,
    altitude: number | undefined,
    distance: number | undefined,
    nitrate: number| undefined,
  ): void {

    const currentTime = position ? JulianDate.toDate(cesiumTime) : null;
    const simplePosition = position ? { x: position.x, y: position.y, z: position.z } : null;
    const simpleVelocity = velocity ? { x: velocity.x, y: velocity.y, z: velocity.z } : null;
    const speed = velocity ? Cartesian3.magnitude(velocity) : null;

    this.animationStateSubject.next({
      currentTime,
      position: simplePosition,
      velocity: simpleVelocity,
      speed,
      altitude: altitude ?? null, // Use nullish coalescing
      distance: distance ?? null,
      nitrate: nitrate ?? null,
    });
  }

  // Optional: Method to get the current state directly (less reactive)
  getCurrentState(): AnimationFrameState {
    return this.animationStateSubject.getValue();
  }
}