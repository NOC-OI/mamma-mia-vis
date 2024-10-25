import { Component } from '@angular/core';
import { HeaderComponent } from "../../core/layout/header/header.component";
import { Cartesian3, createOsmBuildingsAsync, Ion, Math as CesiumMath, Terrain, Viewer } from 'cesium';


@Component({
  selector: 'app-visualisation',
  standalone: true,
  imports: [HeaderComponent],
  templateUrl: './visualisation.component.html',
  styleUrl: './visualisation.component.scss'
})
export class VisualisationComponent {
  
  constructor () {

  }

}
