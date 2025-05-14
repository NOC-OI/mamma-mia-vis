import { Routes } from '@angular/router';
import { VisualisationComponent } from './pages/visualisation/visualisation.component';
import { TestChartComponent } from './test-chart/test-chart.component';

export const routes: Routes = [
    { path: '**', component: VisualisationComponent },
    { path: 'visualisation', component: VisualisationComponent}
];
