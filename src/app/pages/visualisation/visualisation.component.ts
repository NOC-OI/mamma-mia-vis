import {AfterViewInit, Component, OnInit} from '@angular/core';
import {HeaderComponent} from "../../core/layout/header/header.component";
import {Cartesian3, Ion, Viewer, createWorldBathymetryAsync, DirectionalLight, Globe, 
  defined, Scene, Material, Color, HeadingPitchRoll, Math as cesiumMath, Transforms, 
  JulianDate, ClockRange, SampledPositionProperty, SampledProperty, VelocityVectorProperty, 
  Model, ModelAnimationLoop, Matrix3, Matrix4, VelocityOrientationProperty, DistanceDisplayCondition} from 'cesium';
import {MatSliderModule} from '@angular/material/slider';
import {MatInputModule} from '@angular/material/input';
import {FormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';  
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {CampaignService} from '../../services/campaign.service';
import {TrajectoryData} from '../../services/campaign.interface';


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
  enableLighting = true;
  enableFog = false;

  DEPTH_FACTOR = -1
  minHeight = -10000.0;
  seaLevel = 0.0;
  maxHeight = 2000.0;
  countourLineSpacing = 500.0;
  exaggeration = 1;
  startTime = JulianDate.fromDate(new Date(2018, 11, 12, 15));
  velocityVector = new Cartesian3();
  distance = new SampledProperty(Number);
  position = new SampledPositionProperty();
  velocityVectorProperty = new VelocityVectorProperty(this.position, false);
  scene: Scene | undefined;
  globe: Globe | undefined;

  trajectoryData: TrajectoryData | null = null;
  errorMessage: string | null = null;

  constructor(private campaignService: CampaignService) { }

  ngOnInit(): void {
    Ion.defaultAccessToken = process.env['ION_ACCESS_TOKEN'] ? process.env['ION_ACCESS_TOKEN'] : '';
    this.getVehicleTrajectory()
  }

  async ngAfterViewInit(): Promise<void> {
    this.viewer = new Viewer('cesiumContainer', {
      shadows: true,
      shouldAnimate: true,
      terrainProvider: await createWorldBathymetryAsync({
        requestVertexNormals: true,
      }),
    });

    this.setModelRoute();
    this.addEventsToModel("cesium/static/models/autosub-long-range-v2.glb");
    this.addModelToView();

    this.viewer.baseLayerPicker.viewModel.selectedImagery =
      this.viewer.baseLayerPicker.viewModel.imageryProviderViewModels[11];

    this.scene = this.viewer.scene;
    this.globe = this.scene.globe;

    // Prevent the user from tilting beyond the ellipsoid surface
    this.scene.screenSpaceCameraController.maximumTiltAngle = Math.PI / 2.0;

    this.globe.enableLighting = false;
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

  getVehicleTrajectory(){
    this.campaignService.getVehicleTrajectory().subscribe({
      next: (data) => {
        this.trajectoryData = data;
        this.trajectoryData.trajectory.forEach(point => {
          if (typeof point.datetime === 'number') { // Check if it's a number (milliseconds)
              point.datetime = new Date(point.datetime).toISOString(); // Convert to ISO string.
          }
        });
        this.errorMessage = null; // Clear any previous error messages
      },
      error: (error) => {
        this.errorMessage = error.message;
        console.error('Error fetching trajectory data:', error);
      }
    });
  }

  valueChanged() {
    this.updateExaggeration();
  }

  getColorRamp(): HTMLCanvasElement {
    const ramp = document.getElementById("colorRamp") as HTMLCanvasElement;
    ramp.width = 170;
    ramp.height = 20;
    const ctx = ramp.getContext("2d");
    if(ctx) {
      const grd = ctx.createLinearGradient(0, 0, 170, 0);

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
      this.scene.verticalExaggeration = Number(this.exaggeration);
    }
  }

  activateLighting(){
    if(this.globe){
      this.globe.enableLighting = !this.enableLighting;
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

        shadingUniforms.color = this.invertContourLines ? Color.WHITE.withAlpha(0.5) : Color.BLACK.withAlpha(0.5);
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

  createModel(url: string, height: number) {
    if(this.viewer){
      this.viewer.entities.removeAll();
      const position = Cartesian3.fromDegrees(
        -9.498140,
        48.289806,
        height,
      );
      const heading = cesiumMath.toRadians(135);
      const pitch = 0;
      const roll = 0;
      const hpr = new HeadingPitchRoll(heading, pitch, roll);
      const orientation = Transforms.headingPitchRollQuaternion(position, hpr);
    
      const entity = this.viewer.entities.add({
        name: url,
        position: position,
        orientation: orientation,
        model: {
          uri: url,
          minimumPixelSize: 128,
          maximumScale: 20000,
          enableVerticalExaggeration: false,
        },
      });
      this.viewer.trackedEntity = entity;
    }
  }

  setModelRoute() {
    if (this.viewer && this.trajectoryData && this.trajectoryData.trajectory && this.trajectoryData.trajectory.length > 0) { // Check if trajectoryData and trajectory exists and is not empty.
      const firstDateTimeString = this.trajectoryData.trajectory[0].datetime;
      const lastDateTimeString = this.trajectoryData.trajectory[this.trajectoryData.trajectory.length - 1].datetime;

      try {
        const startDate = this.formatDateString(firstDateTimeString);
        const endDate = this.formatDateString(lastDateTimeString);
  
        if (!startDate ||!endDate) {
          console.error("Error parsing start or end time. Check the format of your datetime strings.");
          return;
        }
  
        // 1. Get the timezone offset in minutes:
        const timezoneOffsetMinutes = startDate.getTimezoneOffset();
  
        // 2. Create a new Date object that represents the time in UTC:
        const utcStartDate = new Date(startDate.getTime() - timezoneOffsetMinutes * 60 * 1000);
        const utcEndDate = new Date(endDate.getTime() - timezoneOffsetMinutes * 60 * 1000);
  
  
        this.startTime = JulianDate.fromDate(utcStartDate); // Use the UTC Date
        const endTime = JulianDate.fromDate(utcEndDate);     // Use the UTC Date

        this.viewer.clock.startTime = this.startTime.clone();
        this.viewer.clock.stopTime = endTime.clone();
        this.viewer.clock.currentTime = this.startTime.clone();
        this.viewer.clock.clockRange = ClockRange.LOOP_STOP;
        this.viewer.timeline.zoomTo(this.startTime, endTime);

        this.position = new SampledPositionProperty();
        this.distance = new SampledProperty(Number);
        this.velocityVectorProperty = new VelocityVectorProperty(this.position, false);

        let prevLocation: Cartesian3 | undefined = undefined;
        let totalDistance = 0;

        for (const point of this.trajectoryData.trajectory) {
          const timeString = point.datetime;
          const formattedTimeString = this.formatDateString(timeString); // Format the time string
          const time = JulianDate.fromDate(formattedTimeString); // Use the formatted string
          const location = Cartesian3.fromDegrees(point.longitude, point.latitude, point.depth * this.DEPTH_FACTOR);

          this.position.addSample(time, location);

          if (prevLocation) {
            totalDistance += Cartesian3.distance(location, prevLocation);
          }
          this.distance.addSample(time, totalDistance);
          prevLocation = location;
        }
      } catch (error) {
        console.error("Error setting model route:", error);
      }
    }
  }

  formatDateString(dateString: string): Date {
      // 1. Remove trailing 'Z' if present 
      dateString = dateString.replace(/Z$/, '');
      // 2. Remove fractional seconds (microseconds)
      const parts = dateString.split('.');
      if (parts.length > 1) {
        dateString = parts[0]; // Take only the part before the decimal
      }
      
      try {     
        const date = new Date(dateString); // Attempt to create a Date object      
      if (isNaN(date.getTime())) { // Check if the Date object is valid     
        console.error("Invalid date string:", dateString);      
        return new Date(); // Return null if the date is invalid      
      }
      
      return date; // Return the Date object
      
      } catch (error) {
      console.error("Error parsing date string:", dateString, error);
      return new Date(); // Return null if there's an error
      }
    
  }

  async addEventsToModel(modelUrl: string) {
    if(this.viewer){
      try {
        const modelPrimitive = this.viewer.scene.primitives.add(
          await Model.fromGltfAsync({
            url: modelUrl,
            scale: 4,
            enableVerticalExaggeration: false,
          }),
        );

        /** This event listener ensures the animation starts after the model has fully loaded.
         *  This is important because you can't animate a model that hasn't loaded.
         * */ 
        modelPrimitive.readyEvent.addEventListener(() => {
          modelPrimitive.activeAnimations.addAll({
            loop: ModelAnimationLoop.REPEAT,
            animationTime: (duration: number) => {
              return this.distance.getValue(this.viewer?.clock.currentTime) / duration;
            },
            multiplier: 0.25,
          });
        });
      
        const rotation = new Matrix3();
        // This event listener is called before each frame is rendered. It's used to update the model's position and orientation
        this.viewer.scene.preUpdate.addEventListener(() => {
          const time = this.viewer?.clock.currentTime;
          const pos = this.position.getValue(time) ?? new Cartesian3(0, 0, 0);
          const vel = this.velocityVectorProperty.getValue(time);
          if (vel){
            Cartesian3.normalize(vel, vel);
            // Calculates the rotation matrix based on the model's position and velocity. This is essential for making the model face the direction it's moving.
            Transforms.rotationMatrixFromPositionVelocity(
              pos,
              vel,
              this.viewer?.scene.globe.ellipsoid,
              rotation,
            );
            // Creates the model matrix, combining the rotation and translation (position). This matrix is then applied to the model (modelPrimitive.modelMatrix) to position and orient it in the scene.
            Matrix4.fromRotationTranslation(
              rotation,
              pos,
              modelPrimitive.modelMatrix,
            );
          }
        });
      } catch (error) {
        window.alert(error);
      }
    }
  }

  updateSpeedLabel(time: JulianDate) {
    this.velocityVectorProperty.getValue(time, this.velocityVector);
    const metersPerSecond = Cartesian3.magnitude(this.velocityVector);
    const kmPerHour = Math.round(metersPerSecond * 3.6);
  
    return `${kmPerHour} km/hr`;
  }

  addModelToView() {
    if(this.viewer){
      const modelLabel = this.viewer.entities.add({
        position: this.position,
        orientation: new VelocityOrientationProperty(this.position), // Automatically set the model's orientation to the direction it's facing.
        label: {
          text: this.updateSpeedLabel(this.startTime),
          font: "20px sans-serif",
          showBackground: true,
          distanceDisplayCondition: new DistanceDisplayCondition(0.0, 100.0),
          eyeOffset: new Cartesian3(0, 7.2, 0),
        }
      });
      this.viewer.trackedEntity = modelLabel;
      // modelLabel.viewFrom = new Cartesian3(-30.0, -10.0, 10.0);
    }
  }
  
}
