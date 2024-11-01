import 'zone.js';
import "@angular/compiler";
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';
import 'cesium/Build/Cesium/Widgets/widgets.css';


bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
