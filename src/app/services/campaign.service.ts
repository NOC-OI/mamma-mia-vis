import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError, retry} from 'rxjs/operators';
import {MetricsData, MetricsUnits, TrajectoryData} from './campaign.interface';


@Injectable({
  providedIn: 'root'
})
export class CampaignService {

  private apiTrajectoryUrl = 'http://127.0.0.1:8040/zarr_trajectory?url=./assets/data_inputs/RAPID_array_virtual_mooring.zarr&group=RAD24_01/trajectory';
  private apiMetricsUrl = 'http://127.0.0.1:8040/zarr_metrics?url=./assets/data_inputs/RAPID_array_virtual_mooring.zarr&trajectory_group=RAD24_01/trajectory&reality_group=RAD24_01/payload';
  private apiMetricsUnitsUrl = 'http://127.0.0.1:8040/zarr_metrics_units?url=./assets/data_inputs/RAPID_array_virtual_mooring.zarr&attributes_group=RAD24_01/platform&sensor_name=SBE Glider Payload CTD 9099';


  constructor(private http: HttpClient) { }

  getVehicleTrajectory(): Observable<TrajectoryData> {
    return this.http.get<TrajectoryData>(this.apiTrajectoryUrl)
    .pipe(
        retry(3), // Retry up to 3 times if the request fails
        catchError(this.handleError) // Handle errors
      );
  }

  getMetricsData(): Observable<MetricsData> {
    return this.http.get<MetricsData>(this.apiMetricsUrl)
    .pipe(
        retry(3),
        catchError(this.handleError)
      );
  }

  getMetricsUnits(): Observable<MetricsUnits> {
    return this.http.get<MetricsUnits>(this.apiMetricsUnitsUrl)
    .pipe(
      retry(3),
      catchError(this.handleError)
    )
  }

  private handleError(error: any) {
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      console.error('An error occurred:', error.error.message);
      return throwError(() => new Error('Something went wrong: ' + error.error.message));
    } else {
      // Server-side error
      console.error(
        `Backend returned code ${error.status}, ` +
        `body was: ${error.error}`
      );
      return throwError(() => new Error('Something went wrong: ' + error.status + ' - ' + error.error));
    }
  }
}
