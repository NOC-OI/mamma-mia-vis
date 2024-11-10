import 'zone.js';
import "@angular/compiler";
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

import './styles.scss';
import 'bootstrap';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
