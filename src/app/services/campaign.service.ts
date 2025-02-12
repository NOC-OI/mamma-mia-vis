import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError, retry} from 'rxjs/operators';
import {TrajectoryData} from './campaign.interface';


@Injectable({
  providedIn: 'root'
})
export class CampaignService {

  private apiUrl = 'http://127.0.0.1:8040/zarr_lat_lon?url=./assets/data_inputs/campaign_mm1.zarr&group=mission_mm1/trajectory';

  constructor(private http: HttpClient) { }

  getVehicleTrajectory(): Observable<TrajectoryData> {
    return this.http.get<TrajectoryData>(this.apiUrl)
    .pipe(
        retry(3), // Retry up to 3 times if the request fails
        catchError(this.handleError) // Handle errors
      );
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
