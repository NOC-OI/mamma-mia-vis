import { AfterViewInit, Component, OnInit } from '@angular/core';
import { HeaderComponent } from "../../core/layout/header/header.component";
import { Cartesian3, createOsmBuildingsAsync, Ion, Math as CesiumMath, Terrain, Viewer } from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";


@Component({
  selector: 'app-visualisation',
  standalone: true,
  imports: [HeaderComponent],
  templateUrl: './visualisation.component.html',
  styleUrl: './visualisation.component.scss'
})
export class VisualisationComponent implements OnInit, AfterViewInit{

  viewer: Viewer | undefined;
  
  constructor () {
    
  }

  ngOnInit(): void {
    Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkM2FmMWY5Ny05M2ZkLTQ2MDgtYWRkNy0wMWM1MGVlZmI3NmMiLCJpZCI6MjQ3Njc5LCJpYXQiOjE3Mjg3Nzk5OTZ9.rwBWfMKsBsmEQilYYnWZJZnOOxdLh6lUmasNAQrF8oc';
  }


  ngAfterViewInit(): void {
 
      // Initialize the Cesium Viewer after the view has initialized
      this.viewer = new Viewer('cesiumContainer', {
        terrain: Terrain.fromWorldTerrain(),
      });

      // Fly the camera to a specific location (San Francisco)
      this.viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(-122.4175, 37.655, 400),
        orientation: {
          heading: CesiumMath.toRadians(0.0),
          pitch: CesiumMath.toRadians(-15.0),
        }
      });

      // Load and add Cesium OSM Buildings
      createOsmBuildingsAsync().then(buildingTileset => {
        this.viewer?.scene.primitives.add(buildingTileset);
      });
  }

}
