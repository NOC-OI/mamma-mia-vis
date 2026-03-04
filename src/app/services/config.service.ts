import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

interface AppConfig {
  rootAPIUrl: {
    staging: string
  };
  relativeTrajectoryUrl: {
    bioCarbon: {
      deployment645: string;
      deployment646: string;
      deployment648: string;
      deployment649: string;
      deployment650: string;
    };
    rapidArray: string;
  };
  relativeMetricsUrl: {
    bioCarbon: {
      deployment645: string;
      deployment646: string;
      deployment648: string;
      deployment649: string;
      deployment650: string;
    };
    rapidArray: string;
  };
  relativeMetricsUnitsUrl: {
    bioCarbon: {
      deployment645: string;
      deployment646: string;
      deployment648: string;
      deployment649: string;
      deployment650: string;
    };
    rapidArray: string;
  };
  relativeMissionDeployments: {
    bioCarbon: string;
    rapidArray: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private appConfig: AppConfig | null = null;

  constructor(private http: HttpClient) {}

  // This method loads the config file
  async loadConfig(): Promise<void> {
    try {
      const config = await lastValueFrom(
        this.http.get<AppConfig>('assets/config.json')
      );
      this.appConfig = config;
    } catch (error) {
      console.error('Failed to load app configuration:', error);
      // Handle error, e.g., throw an error or set default values
    }
  }

  // Method to get a specific config value
  get config(): AppConfig {
    if (!this.appConfig) {
      throw new Error('Config not loaded! Ensure loadConfig() is called.');
    }
    return this.appConfig;
  }
}