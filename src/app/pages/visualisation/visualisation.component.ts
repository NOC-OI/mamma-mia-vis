import { AfterViewInit, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { HeaderComponent } from "../../core/layout/header/header.component";
import { Cartesian3, createOsmBuildingsAsync, Ion, Viewer, createWorldBathymetryAsync, DirectionalLight, Globe, defined, Scene, Material, Color, HeadingPitchRoll } from 'cesium';
import {MatSliderModule} from '@angular/material/slider';
import {MatInputModule} from '@angular/material/input';
import {FormsModule} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';  
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';


@Component({
  selector: 'app-visualisation',
  standalone: true,
  imports: [HeaderComponent, MatSliderModule, MatInputModule, FormsModule, MatFormFieldModule, MatCardModule, MatCheckboxModule],
  templateUrl: './visualisation.component.html',
  styleUrls: ['./visualisation.component.scss']
})
export class VisualisationComponent implements OnInit, AfterViewInit {

  viewer: Viewer | undefined;
  showContourLines = true;
  showElevationColorRamp = true;
  invertContourLines = false;
  enableLighting = false;
  enableFog = false;

  minHeight = -10000.0;
  seaLevel = 0.0;
  maxHeight = 2000.0;
  countourLineSpacing = 500.0;
  exaggeration = 1;
  scene: Scene | undefined;
  globe: Globe | undefined;
  viewModel = {};

  constructor() { }

  ngOnInit(): void {
    Ion.defaultAccessToken = process.env['ION_ACCESS_TOKEN'] ? process.env['ION_ACCESS_TOKEN'] : '';
  }

  async ngAfterViewInit(): Promise<void> {
    this.viewer = new Viewer('cesiumContainer', {
      timeline: false,
      animation: false,
      terrainProvider: await createWorldBathymetryAsync({
        requestVertexNormals: true,
      }),
    });

    this.viewModel = {
      exaggeration: this.scene?.verticalExaggeration,
      minHeight: this.minHeight,
      maxHeight: this.maxHeight,
    };

    this.viewer.baseLayerPicker.viewModel.selectedImagery =
      this.viewer.baseLayerPicker.viewModel.imageryProviderViewModels[11];

    this.scene = this.viewer.scene;
    this.globe = this.scene.globe;

    // Prevent the user from tilting beyond the ellipsoid surface
    this.scene.screenSpaceCameraController.maximumTiltAngle = Math.PI / 2.0;

    this.globe.enableLighting = this.enableLighting;
    this.globe.maximumScreenSpaceError = 1.0;

    this.scene.light = new DirectionalLight({
      direction: new Cartesian3(1, 0, 0), // Updated every frame
    });

    const camera = this.scene.camera;
    const cameraMaxHeight = this.globe.ellipsoid.maximumRadius * 2;
    const scratchNormal = new Cartesian3();

    this.scene.preRender.addEventListener(() => {
      const surfaceNormal = this.globe ? this.globe.ellipsoid.geodeticSurfaceNormal(
        camera.positionWC,
        scratchNormal,
      ) : new Cartesian3();
      const negativeNormal = Cartesian3.negate(surfaceNormal, surfaceNormal);
      // if(this.scene){
      //   this.scene.light.direction = Cartesian3.normalize(
      //     Cartesian3.add(negativeNormal, camera.rightWC, surfaceNormal),
      //     this.scene?.light.direction,
      //   );
      // }

      const zoomMagnitude = Cartesian3.magnitude(camera.positionWC) / cameraMaxHeight;
      this.updateGlobeMaterialUniforms(zoomMagnitude);
    });

    this.updateGlobeMaterial();

    this.scene.camera.setView({
      destination: new Cartesian3(
        -3877002.181627189,
        5147948.256341475,
        864384.3423478723,
      ),
      orientation: new HeadingPitchRoll(
        5.914830423853524,
        -0.7139104486007932,
        0.00017507632714419685,
      ),
    });
  }

  valueChanged() {
    this.updateExaggeration();
  }

  getColorRamp(): HTMLCanvasElement {
    const ramp = document.getElementById("colorRamp") as HTMLCanvasElement;
    ramp.width = 100;
    ramp.height = 15;
    const ctx = ramp.getContext("2d");
    if(ctx) {
      const grd = ctx.createLinearGradient(0, 0, 100, 0);

      const d = (height: number) => (height - this.minHeight) / (this.maxHeight - this.minHeight);
      grd?.addColorStop(d(this.maxHeight), "#B79E6C");
      grd?.addColorStop(d(100.0), "#FBFFEE");
      grd?.addColorStop(d(0.0), "#F9FCCA");
      grd?.addColorStop(d(-500.0), "#BDE7AD");
      grd?.addColorStop(d(-1000.0), "#81D2A3");
      grd?.addColorStop(d(-1500.0), "#5AB7A4");
      grd?.addColorStop(d(-2000.0), "#4C9AA0");
      grd?.addColorStop(d(-2500.0), "#437D9A");
      grd?.addColorStop(d(-4000.0), "#3E6194");
      grd?.addColorStop(d(-5000.0), "#424380");
      grd?.addColorStop(d(-8000.0), "#392D52");
      grd?.addColorStop(d(this.minHeight), "#291C2F");
  
      ctx.fillStyle = grd ? grd : new CanvasGradient();
      ctx.fillRect(0, 0, ramp.width, ramp.height);
    }

    return ramp;
  }

  getElevationContourMaterial(): Material {
    return new Material({
      fabric: {
        type: "ElevationColorContour",
        materials: {
          contourMaterial: { type: "ElevationContour" },
          elevationRampMaterial: { type: "ElevationRamp" }
        },
        components: {
          diffuse:
            "(1.0 - contourMaterial.alpha) * elevationRampMaterial.diffuse + contourMaterial.alpha * contourMaterial.diffuse",
          alpha: "max(contourMaterial.alpha, elevationRampMaterial.alpha)"
        }
      },
      translucent: false,
    });
  }

  updateExaggeration() {
    if(this.scene){
      const viewModel = {
        exaggeration: this.exaggeration,
        minHeight: this.minHeight,
        maxHeight: this.maxHeight,
      };
      this.scene.verticalExaggeration = Number(viewModel.exaggeration);
    }
  }

  activateLighting(){
    if(this.globe){
      this.globe.enableLighting = this.enableLighting;
    }
  }

  activateFog() {
    if(this.scene && this.globe) {
      this.scene.fog.enabled = this.enableFog;
      this.globe.showGroundAtmosphere = this.enableFog;
    }
  }

  activateColourRamp() { 
    this.updateGlobeMaterial();
  }

  enableContourLines() {
    this.updateGlobeMaterial();
  }

  enableInvertContourLines() {
    this.updateGlobeMaterial();
  }

  updateGlobeMaterialUniforms(zoomMagnitude: number): void {
    const material = this.globe?.material;
    if (!defined(material)) {
      return;
    }

    const spacing = 5.0 * Math.pow(10, Math.floor(4 * zoomMagnitude));
    const verticalExaggeration = this.scene ? this.scene.verticalExaggeration : 1.0;
    if (this.showContourLines) {
      const uniforms = this.showElevationColorRamp
        ? material.materials.contourMaterial.uniforms
        : material.uniforms;

      uniforms.spacing = spacing * verticalExaggeration;
    }

    if (this.showElevationColorRamp) {
      const uniforms = this.showContourLines
        ? material.materials.elevationRampMaterial.uniforms
        : material.uniforms;

      uniforms.spacing = spacing * verticalExaggeration;
      uniforms.minimumHeight = this.minHeight * verticalExaggeration;
      uniforms.maximumHeight = this.maxHeight * verticalExaggeration;
    }
  }

  updateGlobeMaterial(): void {
    let material;
    const verticalExaggeration = this.scene ? this.scene.verticalExaggeration : 1.0;
    if (this.showContourLines) {
      if (this.showElevationColorRamp) {
        material = this.getElevationContourMaterial();
        let shadingUniforms = material.materials.elevationRampMaterial.uniforms;
        shadingUniforms.image = this.getColorRamp();
        shadingUniforms.minimumHeight = this.minHeight * verticalExaggeration;
        shadingUniforms.maximumHeight = this.maxHeight * verticalExaggeration;
        shadingUniforms = material.materials.contourMaterial.uniforms;
        shadingUniforms.width = 1.0;
        shadingUniforms.spacing = this.countourLineSpacing * verticalExaggeration;
        shadingUniforms.color = this.invertContourLines
          ? Color.WHITE.withAlpha(0.5)
          : Color.BLACK.withAlpha(0.5);
        if(this.globe){
          this.globe.material = material;
        }
        return;
      }

      material = Material.fromType("ElevationContour");
      const shadingUniforms = material.uniforms;
      shadingUniforms.width = 1.0;
      shadingUniforms.spacing = this.countourLineSpacing * verticalExaggeration;
      shadingUniforms.color = this.invertContourLines ? Color.WHITE : Color.BLACK;
      if(this.globe){
        this.globe.material = material;
      }
      return;
    }

    if (this.showElevationColorRamp) {
      material = Material.fromType("ElevationRamp");
      const shadingUniforms = material.uniforms;
      shadingUniforms.image = this.getColorRamp();
      shadingUniforms.minimumHeight = this.minHeight * verticalExaggeration;
      shadingUniforms.maximumHeight = this.maxHeight * verticalExaggeration;
      if(this.globe){
        this.globe.material = material;
      }
      return;
    }

    if(this.globe){
      this.globe.material = material;
    }
  }
}
