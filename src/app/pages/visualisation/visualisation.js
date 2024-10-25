Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkM2FmMWY5Ny05M2ZkLTQ2MDgtYWRkNy0wMWM1MGVlZmI3NmMiLCJpZCI6MjQ3Njc5LCJpYXQiOjE3Mjg3Nzk5OTZ9.rwBWfMKsBsmEQilYYnWZJZnOOxdLh6lUmasNAQrF8oc';

// Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});    

// Fly the camera to San Francisco at the given longitude, latitude, and height.
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(-122.4175, 37.655, 400),
  orientation: {
    heading: Cesium.Math.toRadians(0.0),
    pitch: Cesium.Math.toRadians(-15.0),
  }
});

// Add Cesium OSM Buildings, a global 3D buildings layer.
const buildingTileset = Cesium.createOsmBuildingsAsync();
viewer.scene.primitives.add(buildingTileset);   