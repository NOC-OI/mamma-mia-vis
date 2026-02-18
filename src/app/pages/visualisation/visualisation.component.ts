import {AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {HeaderComponent} from "../../core/layout/header/header.component";
import {Cartesian3, Ion, Viewer, DirectionalLight, Globe, 
  defined, Scene, Material, Color, HeadingPitchRoll, Math as cesiumMath, Transforms, 
  JulianDate, ClockRange, SampledPositionProperty, SampledProperty, VelocityVectorProperty, 
  Model, ModelAnimationLoop, Matrix3, Matrix4, VelocityOrientationProperty, DistanceDisplayCondition,
  Ellipsoid, IonGeocodeProviderType, createGooglePhotorealistic3DTileset, CesiumTerrainProvider, CzmlDataSource} from 'cesium';
import {MatSliderModule} from '@angular/material/slider';
import {MatInputModule} from '@angular/material/input';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';  
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatSelectModule} from '@angular/material/select';
import {CampaignService} from '../../services/campaign.service';
import {MetricsPage, MetricsUnits, TrajectoryData} from '../../services/campaign.interface';
import {AnimationStateService} from '../../services/animation-state.service';
import {Observable, Subscription, of} from 'rxjs';
import {delay, expand, skip} from 'rxjs/operators';
import {LineChartComponent} from "../../graphs/line-chart/line-chart.component";
import {MetricChartComponent} from '../../metric-chart/metric-chart.component';
import {MatDatepickerInputEvent, MatDatepickerModule} from '@angular/material/datepicker';
import {MatTabChangeEvent, MatTabsModule } from '@angular/material/tabs';
import {provideNativeDateAdapter} from '@angular/material/core';

@Component({
  selector: 'app-visualisation',
  standalone: true,
  imports: [HeaderComponent, MatSliderModule, MatInputModule, FormsModule, MatFormFieldModule, 
            MatCardModule, MatCheckboxModule, MatSelectModule, LineChartComponent, MetricChartComponent, 
            MatFormFieldModule, MatDatepickerModule, FormsModule, ReactiveFormsModule, MatTabsModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './visualisation.component.html',
  styleUrls: ['./visualisation.component.scss']
})
export class VisualisationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cesiumContainer') container!: ElementRef;
  viewer: Viewer | undefined;
  showContourLines = true;
  showElevationColorRamp = true;
  invertContourLines = false;
  enableLighting = true;
  enableFog = false;

  DEPTH_FACTOR = -1;
  minHeight = -10000.0;
  seaLevel = 0.0;
  maxHeight = 2000.0;
  countourLineSpacing = 500.0;
  exaggeration = 1;
  startTime = JulianDate.fromDate(new Date(2018, 11, 12, 15));
  velocityVector = new Cartesian3();
  distance = new SampledProperty(Number);
  position = new SampledPositionProperty();
  conductivityProperty: SampledProperty = new SampledProperty(Number);
  temperatureProperty: SampledProperty = new SampledProperty(Number);
  pressureProperty: SampledProperty = new SampledProperty(Number);
  velocityVectorProperty = new VelocityVectorProperty(this.position, false);
  scene: Scene | undefined;
  globe: Globe | undefined;

  trajectoryData: TrajectoryData | null = null;
  PAGE_NUMBER = 1;
  PAGE_SIZE = 1000;
  metricsData: MetricsPage = { metrics: [], totalRecords: 0, currentPage: 1, recordsPerPage: this.PAGE_SIZE };
  metricsUnits: MetricsUnits | null = null;
  errorMessage: string | null = null;
  selectedMission = "";
  currentMission = "";
  selectedDeployment = ""
  currentDeployment = "";
  numberOfRecords = 1000;
  currentNumberOfRecords = 0;
  readingVariables: Array<string> = ["pressure", "salinity", "temperature", "chlorophyll"];
  timeSeriesTitles: Array<string> = ["Sea Water Pressure, equals 0 at sea-level", "Sea Water Practical Salinity", "Sea Water Temperature", "Mass Concentration of Chlorophyll in Sea Water"]
  showDeploymentsList = false;
  isLoading = false;
  recordsPerPage = this.PAGE_SIZE;
  startDate: Date | null = null;
  endDate: Date | null = null;
  strStartDate = "";
  strEndDate = "";

  private fetchSubscription: Subscription | null = null;

  private preUpdateListener: (() => void) | undefined;

  constructor(private campaignService: CampaignService, private animationStateService: AnimationStateService, private ngZone: NgZone) { }

  ngOnInit(): void {
    Ion.defaultAccessToken = process.env['ION_ACCESS_TOKEN'] ? process.env['ION_ACCESS_TOKEN'] : '';
  }

  ngAfterViewInit(){
    this.ngZone.runOutsideAngular(async () => {
      await this.setGlobalScene();
    });
  }

  ngOnDestroy(): void {
    // Clean up Cesium resources
    this.cleanUpResources();
  }

  onTabChange(event: MatTabChangeEvent){
    if(event.index === 0 && !this.viewer){
      this.setGlobalScene();
    }
  }

  cleanUpResources(){
    if (this.viewer) {
      if (this.preUpdateListener) {
        this.viewer.scene.preUpdate.removeEventListener(this.preUpdateListener);
        this.preUpdateListener = undefined;
      }
      this.viewer.destroy();
      this.viewer = undefined;
    }

    if (this.fetchSubscription) {
      this.fetchSubscription.unsubscribe();
    }
  }

  async setGlobalScene(){
    if (this.viewer) {
      this.viewer.destroy(); // Clean up if it already exists
    }
    const terrainProvider = await CesiumTerrainProvider.fromIonAssetId(2426648);

    this.viewer = new Viewer(this.container.nativeElement, {
      shadows: true,
      shouldAnimate: true,
      geocoder: IonGeocodeProviderType.GOOGLE,
      terrainProvider: terrainProvider,
    });

    // this.setModelRoute();
    // this.processMetricsData();
    // this.addEventsToModel("cesium/static/models/autosub-long-range-v3.glb");
    // this.addModelToView();
    
    if(this.viewer){
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

      // this.updateGlobeMaterial();

      this.scene.camera.setView({
        destination: new Cartesian3(
          -2710292.813384663,
          -4360657.061518585,
          3793571.786860543,
        ),
        orientation: new HeadingPitchRoll(
          5.794062761901799,
          -0.30293409742984756,
          0.0009187098191985044,
        ),
      });

      // Enable rendering the sky
      this.scene.skyAtmosphere.show = true;
      // this.addPhotorealistic3Dtiles(this.scene);

    }
  }

  async addPhotorealistic3Dtiles(scene: Scene){
    try {
        const tileset = await createGooglePhotorealistic3DTileset();
      scene.primitives.add(tileset);      
    } catch (error) {
      console.log(`Error loading Photorealistic 3D Tiles tileset. ${error}`);
    }
  }

  processMetricsData(): void {
    if (!this.metricsData || !this.metricsData.metrics || this.metricsData.metrics.length === 0) {
        console.warn("No metrics data available to process.");
        return;
    }

    this.conductivityProperty = new SampledProperty(Number); // Reinitialize
    this.temperatureProperty = new SampledProperty(Number);
    this.pressureProperty = new SampledProperty(Number);
    try {
        for (const reading of this.metricsData.metrics) {
            if (typeof reading.conductivity === 'number' && !isNaN(reading.conductivity)) { // Check if Conductivity is a valid number
                const time = JulianDate.fromDate(this.formatDateString(reading.datetime));
                this.conductivityProperty.addSample(time, reading.conductivity);
            }
            if (typeof reading.temperature == 'number' && !isNaN(reading.temperature)) {
              const time = JulianDate.fromDate(this.formatDateString(reading.datetime));
              this.temperatureProperty.addSample(time, reading.temperature);
            }
            if(typeof reading.pressure == 'number' && !isNaN(reading.pressure)){
              const time = JulianDate.fromDate(this.formatDateString(reading.datetime));
              this.pressureProperty.addSample(time, reading.pressure);
            }
        }
    } catch (error) {
        console.error("Error processing metrics data:", error);
    }
  }

  valueChanged() {
    this.updateExaggeration();
  }

  getColorRamp(): HTMLCanvasElement {
    const ramp = document.getElementById("colorRamp") as HTMLCanvasElement;
    if(ramp){
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

  setParamsForTimeSeriesGraph() { 
    this.showDeploymentsList = this.selectedMission == "bioCarbon";
    this.currentMission = this.selectedMission;
    this.currentDeployment = this.selectedDeployment;
    this.currentNumberOfRecords = this.numberOfRecords;
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
        -24.14199999861106,
        23.79999999949824,
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
    if (this.viewer && this.metricsData && this.metricsData.metrics && this.metricsData.metrics.length > 0) { // Check if trajectoryData and trajectory exists and is not empty.
      const firstDateTimeString = this.metricsData.metrics[0].datetime;
      const lastDateTimeString = this.metricsData.metrics[this.metricsData.metrics.length - 1].datetime;

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

        for (const point of this.metricsData.metrics) {
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

  inputStartDate(event: MatDatepickerInputEvent<Date>) {
    this.startDate = event.value;
  }

  inputEndDate(event: MatDatepickerInputEvent<Date>) {
    this.endDate = event.value;
    this.strStartDate = this.convertToISO(this.startDate);
    this.strEndDate = this.convertToISO(this.endDate);
    this.setParamsForTimeSeriesGraph();
    this.getAUVTrajectory();
  }

  convertToISO(inputDate: Date | null): string {
    let isoDate = null;
    if(inputDate){
      const padStart = (value: number): string =>
          value.toString().padStart(2, '0');
      isoDate = `${padStart(inputDate.getFullYear())}-${padStart(inputDate.getMonth() + 1)}-${inputDate.getDate()} ${padStart(inputDate.getHours())}:${padStart(inputDate.getMinutes())}:${padStart(inputDate.getSeconds())}`;
    }
    return isoDate ? isoDate : "";
  }

  /**
   * Initializes and manages the sequential fetching of paginated data.
   */
  startSequentialMetricsFetch(): void {
    //TODO: Check if this logic is useful to play an animation of data by a period of time
    
    this.isLoading = true;
    this.metricsData = { metrics: [], totalRecords: Infinity, currentPage: 1, recordsPerPage: this.PAGE_SIZE };

    let currentPage = 0; 
    let totalRecords = Infinity;

    // Step 1: Create an Observable stream that handles the loop.
    const fetchPage$ = of(null).pipe(
      expand((page: MetricsPage | null) => {
        // Stop condition check
        if (page && this.metricsData.metrics.length >= totalRecords) {
          console.log(' STOPPING! All records fetched.');
          return of(); 
        }

        if (page) {
            currentPage++; 
        }

        this.strStartDate = this.convertToISO(this.startDate);
        this.strEndDate = this.convertToISO(this.endDate);
        
        return this.campaignService.getMetricsData(
          this.selectedMission,
          this.selectedDeployment,
          this.strStartDate,
          this.strEndDate,
          currentPage,
          this.recordsPerPage
        ).pipe(
          delay(50) 
        );
      }),
      
      // We skip the initial seed value 'of(null)'
      skip(1)
      
    // *** FIX: Explicitly cast the final Observable type ***
    ) as Observable<MetricsPage>;
    
    // Step 2: Subscribe to the main Observable to process the data
    // The type of 'page' is now definitively known as 'MetricsPage'
    this.fetchSubscription = fetchPage$.subscribe({
      next: (page: MetricsPage) => { // This line is now safe
        // Update the total records after the first successful call
        if (totalRecords === Infinity) {
          totalRecords = page.totalRecords;
        }

        // Process and append the data from the current page
        this.appendAndProcessMetrics(page);
        
      },
      error: (error) => {
        this.errorMessage = error.message;
        console.error('Error fetching metrics data:', error);
        this.isLoading = false;
      },
      complete: () => {
        console.log('All metrics data fetched and processed.');
        this.isLoading = false;
      }
    });
  }
  
  /**
   * Processes the data from a single page and appends it to the main store.
   * @param page The metrics data page received from the API.
   */
  private appendAndProcessMetrics(page: MetricsPage): void {


    if(page.metrics){
      // 1. Append the new data
      this.metricsData.metrics = page.metrics;
      // 2. Apply your existing data processing logic
      page.metrics.forEach(metricsReading => {
        if (typeof metricsReading.datetime === 'number') {
            metricsReading.datetime = new Date(metricsReading.datetime).toISOString();
        }
      });

      // 3. Run processing for the newly added data
      // this.processMetricsData();
      this.addSensorReadingsToTimeSeries();
      
      console.log(`Fetched page ${page.currentPage}. Total records: ${this.metricsData.metrics.length}`);
    }

  }

  addSensorReadingsToTimeSeries(){
    let times: String[] = [];
    let conductivityLevels: number[] = [];
    let temperatures: number[] = [];
    let pressures: number[] = [];
    if(this.metricsData){
      this.metricsData.metrics.forEach( sensorReading => {
        times.push(sensorReading.datetime);

        conductivityLevels.push(sensorReading.conductivity ? sensorReading.conductivity : NaN);
        
        
        temperatures.push(sensorReading.temperature? sensorReading.temperature : NaN);
        
        
        pressures.push(sensorReading.pressure ? sensorReading.pressure : NaN);
        
      });
      this.animationStateService.updateState(times, conductivityLevels, temperatures, pressures);
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
        const ellipsoid = this.viewer.scene.globe?.ellipsoid ?? Ellipsoid.WGS84; // Get ellipsoid

        // This event listener is called before each frame is rendered. It's used to update the model's position and orientation
        // Store the listener function to remove it later
        this.preUpdateListener = () => {
          if (!this.viewer) return; // Guard clause
          
          const time = this.viewer.clock.currentTime;
          const pos = this.position.getValue(time); // Can be undefined if time is outside samples
          if (!pos) return;
          const vel = this.velocityVectorProperty.getValue(time); // Can be undefined
          const dist = this.distance.getValue(time); // Can be undefined
          const currentConductivityLevel = this.conductivityProperty.getValue(time);
          const currentTemperature = this.temperatureProperty.getValue(time);
          const currentPressure = this.pressureProperty.getValue(time);

          let altitude: number | undefined = undefined;
          if (pos) {
             const cartographic = ellipsoid.cartesianToCartographic(pos);
             altitude = cartographic?.height; // Get altitude from cartographic coordinates
          }

          // *** UPDATE THE SHARED SERVICE ***
          // this.animationStateService.updateState(time, pos, vel, altitude, dist, currentConductivityLevel, currentTemperature, currentPressure);
          // *********************************
          // Update model transform (only if pos and vel are valid)
          if (pos && vel.x && vel.y && vel.z){
            Cartesian3.normalize(vel, vel);
            Transforms.rotationMatrixFromPositionVelocity(
              pos,
              vel,
              ellipsoid,
              rotation,
            );
            Matrix4.fromRotationTranslation(
              rotation,
              pos,
              modelPrimitive.modelMatrix, // Apply directly to the loaded model
            );
          } else if (pos) {
              // Handle cases where velocity might be undefined (e.g., start/end points)
              // Set a default orientation or keep the last known orientation if needed
              Matrix4.fromTranslation(pos, modelPrimitive.modelMatrix); // Just set position
          }
        };

        this.viewer.scene.preUpdate.addEventListener(this.preUpdateListener);
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

  getAUVTrajectory(){
    if (this.selectedMission == "rapidArray" || (this.selectedMission == "bioCarbon" && this.selectedDeployment)){
      if(this.numberOfRecords > 0){
            this.campaignService.getVehicleTrajectory(this.selectedMission, this.selectedDeployment, this.strStartDate, this.strEndDate, this.PAGE_NUMBER, this.numberOfRecords).subscribe({
              next: (data) => {
                this.trajectoryData = data;
                this.addAUVTrajectoryToView();
                this.errorMessage = null;
          
              },
              error: (error) => {
                this.errorMessage = error.message;
                console.error('Error fetching metrics data:', error);
              }
            });
      }
    }
  }
  addAUVTrajectoryToView(){
    if(this.viewer){
      this.viewer.dataSources.add(CzmlDataSource.load(this.trajectoryData?.trajectory));
        this.viewer.scene.camera.setView({
          destination: Cartesian3.fromDegrees(-116.52, 35.02, 95000),
          orientation: {
            heading: 6,
          },
      });
    }
  }
}
