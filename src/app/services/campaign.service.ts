import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError, retry} from 'rxjs/operators';
import {MetricsPage, MetricsUnits, TrajectoryData} from './campaign.interface';
import { ConfigService } from './config.service';


@Injectable({
  providedIn: 'root'
})
export class CampaignService {

  private rootAPIUrl = "";

  constructor(private http: HttpClient, private configService: ConfigService) { 
    this.rootAPIUrl = this.configService.config.rootAPIUrl.staging;
  }

  getVehicleTrajectory(selectedMission: string, selectedDeployment: string): Observable<TrajectoryData> {
    let trajectoryDeploymentUrl = selectedMission == "bioCarbon" ? 
                              "" : this.configService.config.relativeTrajectoryUrl.rapidArray;
        
    if(selectedDeployment){
        switch(selectedDeployment){
          case "deployment645": 
            trajectoryDeploymentUrl = this.configService.config.relativeTrajectoryUrl.bioCarbon.deployment645;//TODO: Test with this syntaxt .biocarbon["deployment645"] to simplify code
            break;
          case "deployment646":
            trajectoryDeploymentUrl = this.configService.config.relativeTrajectoryUrl.bioCarbon.deployment646;
            break;
          case "deployment648":
            trajectoryDeploymentUrl = this.configService.config.relativeTrajectoryUrl.bioCarbon.deployment648;
            break;
          case "deployment649":
            trajectoryDeploymentUrl = this.configService.config.relativeTrajectoryUrl.bioCarbon.deployment649;
            break;
          case "deployment650":
            trajectoryDeploymentUrl = this.configService.config.relativeTrajectoryUrl.bioCarbon.deployment649;
            break;
        }
    }

  trajectoryDeploymentUrl = this.rootAPIUrl + trajectoryDeploymentUrl;
  console.log(' URL: ', trajectoryDeploymentUrl);
  return this.http.get<TrajectoryData>(trajectoryDeploymentUrl)
  .pipe(
      retry(3), // Retry up to 3 times if the request fails
      catchError(this.handleError) // Handle errors
    );
  }

  getMetricsData(selectedMission: string, selectedDeployment: string, page: number, recordsPerPage: number): Observable<MetricsPage> {
    let metricsDeploymentUrl = selectedMission == "bioCarbon" ? 
                              "" : this.configService.config.relativeMetricsUrl.rapidArray;
    if(selectedDeployment){
        switch(selectedDeployment){
          case "deployment645": 
            metricsDeploymentUrl = this.configService.config.relativeMetricsUrl.bioCarbon.deployment645;
            break;
          case "deployment646":
            metricsDeploymentUrl = this.configService.config.relativeMetricsUrl.bioCarbon.deployment646;
            break;
          case "deployment648":
            metricsDeploymentUrl = this.configService.config.relativeMetricsUrl.bioCarbon.deployment648;
            break;
          case "deployment649":
            metricsDeploymentUrl = this.configService.config.relativeMetricsUrl.bioCarbon.deployment649;
            break;
          case "deployment650":
            metricsDeploymentUrl = this.configService.config.relativeMetricsUrl.bioCarbon.deployment649;
            break;
        }
    }
    
    metricsDeploymentUrl = `${this.rootAPIUrl}${metricsDeploymentUrl}&page=${page}&records_per_page=${recordsPerPage}`;
    return this.http.get<MetricsPage>(metricsDeploymentUrl)
    .pipe(
        retry(3),
        catchError(this.handleError)
      );
  }

  getMetricsUnits(selectedMission: string): Observable<MetricsUnits> {
    let relativeMetricsUnitsUrl = selectedMission == "bioCarbon" ? 
                                  this.configService.config.relativeMetricsUnitsUrl.bioCarbon : 
                                  this.configService.config.relativeMetricsUnitsUrl.rapidArray;
    const apiMetricsUnitsUrl = this.rootAPIUrl + relativeMetricsUnitsUrl;
    return this.http.get<MetricsUnits>(apiMetricsUnitsUrl)
    .pipe(
      retry(3),
      catchError(this.handleError)
    )
  }

  getMissionDeployments(): Observable<string[]>{
    let apiMissionDeploymentsUrl = this.rootAPIUrl + this.configService.config.relativeMissionDeployments;
    return this.http.get<string[]>(apiMissionDeploymentsUrl)
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
