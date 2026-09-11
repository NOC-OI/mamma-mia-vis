import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HeaderComponent } from "../../core/layout/header/header.component";
import {
  Cartesian3, Ion, Viewer, DirectionalLight, Globe,
  defined, Scene, Material, HeadingPitchRoll,
  JulianDate, SampledPositionProperty, SampledProperty, VelocityVectorProperty,
  IonGeocodeProviderType, createGooglePhotorealistic3DTileset, CzmlDataSource,
  createWorldBathymetryAsync
} from 'cesium';
import { MatSliderModule } from '@angular/material/slider';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { CampaignService } from '../../services/campaign.service';
import { MetricsPage, MetricsUnits, TrajectoryData } from '../../services/campaign.interface';
import { AnimationStateService } from '../../services/animation-state.service';
import { Subscription } from 'rxjs';
import { LineChartComponent } from "../../graphs/line-chart/line-chart.component";
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatTabChangeEvent, MatTabsModule } from '@angular/material/tabs';
import { provideNativeDateAdapter } from '@angular/material/core';

@Component({
  selector: 'app-visualisation',
  standalone: true,
  imports: [HeaderComponent, MatSliderModule, MatInputModule, FormsModule, MatFormFieldModule,
    MatCardModule, MatCheckboxModule, MatSelectModule, LineChartComponent, MatFormFieldModule,
    MatDatepickerModule, FormsModule, ReactiveFormsModule, MatTabsModule, DatePipe],
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
  metricsData: MetricsPage = { metrics: [], totalRecords: 0 };
  metricsUnits: MetricsUnits | null = null;
  errorMessage: string | null = null;
  selectedMission = "";
  currentMission = "";
  selectedDeployment = ""
  currentDeployment = "";
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

  constructor(private campaignService: CampaignService, private animationStateService: AnimationStateService, private ngZone: NgZone) {

  }

  ngOnInit(): void {
    Ion.defaultAccessToken = process.env['ION_ACCESS_TOKEN'] ? process.env['ION_ACCESS_TOKEN'] : '';
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(async () => {
      await this.setGlobalScene();
    });
  }

  ngOnDestroy(): void {
    // Clean up Cesium resources
    this.cleanUpResources();
  }

  onTabChange(event: MatTabChangeEvent) {
    if (event.index === 0 && !this.viewer) {
      this.setGlobalScene();
    }
  }

  cleanUpResources() {
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

  async setGlobalScene() {
    if (this.viewer) {
      this.viewer.destroy();
    }

    // const terrainProvider = await CesiumTerrainProvider.fromIonAssetId(2426648);
    const terrainProvider = await createWorldBathymetryAsync({
      requestVertexNormals: true,
    })

    this.viewer = new Viewer(this.container.nativeElement, {
      shadows: true,
      shouldAnimate: true,
      geocoder: IonGeocodeProviderType.GOOGLE,
      terrainProvider: terrainProvider,
    });

    if (this.viewer) {
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

      this.scene.preRender.addEventListener(() => {

        const zoomMagnitude = Cartesian3.magnitude(camera.positionWC) / cameraMaxHeight;
        this.updateGlobeMaterialUniforms(zoomMagnitude);
      });

      this.scene.camera.setView({
        destination: Cartesian3.fromDegrees(
          -12.659740,
          60.610335998535156,
          140000),
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

  async addPhotorealistic3Dtiles(scene: Scene) {
    try {
      const tileset = await createGooglePhotorealistic3DTileset();
      scene.primitives.add(tileset);
    } catch (error) {
      console.log(`Error loading Photorealistic 3D Tiles tileset. ${error}`);
    }
  }


  setParamsForTimeSeriesGraph() {
    this.showDeploymentsList = this.selectedMission == "bioCarbon";
    this.currentMission = this.selectedMission;
    this.currentDeployment = this.selectedDeployment;
    this.displayAUVTrajectory();
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


  inputStartDate(event: MatDatepickerInputEvent<Date>) {
    this.startDate = event.value;
  }

  inputEndDate(event: MatDatepickerInputEvent<Date>) {
    this.endDate = event.value;
    this.displayAUVTrajectory();
  }

  displayAUVTrajectory() {
    if (this.startDate && this.endDate) {
      this.strStartDate = this.convertToISO(true, this.startDate);
      this.strEndDate = this.convertToISO(false, this.endDate);
      this.getAUVTrajectory();
    }
  }

  convertToISO(isStartDate: boolean, inputDate: Date | null): string {
    let isoDate = null;
    let time = "";
    if (inputDate) {
      const padStart = (value: number): string =>
        value.toString().padStart(2, '0');
      time = isStartDate ? "00:00:00" : "23:59:59";
      isoDate = `${padStart(inputDate.getFullYear())}-${padStart(inputDate.getMonth() + 1)}-${inputDate.getDate()} ${time}`;
    }
    return isoDate ? isoDate : "";
  }


  getAUVTrajectory() {
    if (this.selectedMission == "rapidArray" || (this.selectedMission == "bioCarbon" && this.selectedDeployment)) {
      this.selectedDeployment = this.selectedMission == "rapidArray" ? "" : this.selectedDeployment;
      this.campaignService.getVehicleTrajectory(this.selectedMission, this.selectedDeployment, this.strStartDate, this.strEndDate).subscribe({
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

  addAUVTrajectoryToView() {
    if (this.viewer && this.trajectoryData && this.trajectoryData.trajectory.length > 0) {
      this.viewer.dataSources.removeAll();
      this.viewer.dataSources.add(CzmlDataSource.load(this.trajectoryData.trajectory));
      this.viewer.scene.camera.setView({
        destination: Cartesian3.fromDegrees(this.trajectoryData.startCoordinates[0], this.trajectoryData.startCoordinates[1], 4195000),
        orientation: {
          heading: 6,
        },
      });
    }
  }
}
