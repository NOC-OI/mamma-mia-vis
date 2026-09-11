# Getting Started

This guide walks you through setting up, configuring, and running the **MAMMA MIA Visualisation** frontend application, as well as serving and building this documentation.

---

## Prerequisites

Before running the application, make sure you have the following installed:

- **Node.js**: Version `18.x` or `20.x` (LTS recommended)
- **npm**: Version `9.x` or higher (comes bundled with Node.js)
- **Python 3**: Version `3.8+` with `pip` (required for MkDocs)
- **Cesium Ion Access Token**: An active token from [Cesium Ion](https://ion.cesium.com/) for bathymetric terrain and geocoding services.
- **MAMMA MIA Backend** Install [MAMMA MIA backend](https://noc-oi.github.io/mamma-mia-vis-backend/) for full data integration. The FastAPI backend serving Zarr datasets (default URL: `http://127.0.0.1:8040/`).

---

## Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/NOC-OI/mamma-mia-vis.git
   cd mamma-mia-vis
   ```

2. **Install Node Dependencies**
   ```bash
   npm install
   ```

3. **Install Documentation Dependencies**
   To preview and build the MkDocs documentation:

    - **Set Up Virtual Environment (Recommended)**

          a. *Creating a Python virtual environment*
            ```bash
            python3 -m venv venv
            source venv/bin/activate
            ```
          b. *Alternatively, create a Conda environment*
            ```bash
            conda create --name mamma-mia-vis-docs
            conda activate mamma-mia-vis-docs
            ```

    - **Installing Dependencies**

          a. *Install dependencies in the Python environment*
          ```bash
          pip install -r requirements.txt
          ```
          b. *Alternatively, install dependencies from requirements.txt in the Conda environment*
          ```bash
          conda install --file --yes requirements.txt
          ```


---

## Configuration

### 1. Backend API Endpoint
The frontend reads its API routing configuration from `src/assets/config.json`. By default, it connects to the local development backend:

```json title="src/assets/config.json"
{
  "rootAPIUrl": {
    "staging": "http://127.0.0.1:8040/"
  },
  "relativeTrajectoryUrl": {
    "bioCarbon": {
      "deployment645": "zarr_trajectory?url=./assets/data_inputs/BIO-Carbon.zarr&payload_group=Deployment_645/payload&platform_group=Deployment_645/platform&platform_model_name=platform_type",
      ...
    },
    "rapidArray": "zarr_trajectory?url=./assets/data_inputs/RAPID_array_virtual_mooring.zarr&payload_group=RAD24_01/payload&platform_group=RAD24_01/platform&platform_model_name=platform_model"
  },
  ...
}
```

Ensure your backend is running at `http://127.0.0.1:8040/` or update the `rootAPIUrl.staging` address to point to your target server.

### 2. Cesium Ion Access Token
Cesium requires an Ion access token to load world bathymetry and terrain. The token is defined in `webpack.config.js` via `webpack.DefinePlugin`:

```javascript title="webpack.config.js"
new webpack.DefinePlugin({
  CESIUM_BASE_URL: JSON.stringify(cesiumBaseUrl),
  'process.env': {
    ION_ACCESS_TOKEN: JSON.stringify('YOUR_CESIUM_ION_ACCESS_TOKEN')
  }
})
```

You can replace this with your own token or provide it via your environment during build time.

---

## Running the Development Server

Start the Webpack development server with:

```bash
npm run start
```

The application will start at:
👉 **`http://localhost:8080/`**

Features of the development environment:
- **Hot Module Replacement (HMR)**: Changes to HTML, SCSS, and TypeScript files are instantly reloaded.
- **Cesium Asset Copying**: Cesium workers, widgets, third-party libraries, and 3D models (`autosub-long-range-v3.glb`) are served dynamically under `/cesium/static/`.
- **History API Fallback**: Direct navigation to routes (such as `/visualisation`) falls back to `index.html`.

---

## Building for Production

Compile and bundle the production assets with:

```bash
npm run build
```

The compiled bundles and static assets will be output to the `public/` directory:
- `public/app.js`
- `public/vendor.js`
- `public/index.html`
- `public/cesium/static/*`
- `public/assets/*`

---

## Running with Docker

You can containerize and run the application using the included multi-stage `Dockerfile` and `nginx.conf`:

1. **Build the Docker Image**:
   ```bash
   docker build -t mamma-mia-vis-frontend .
   ```

2. **Run the Container**:
   ```bash
   docker run -d -p 8080:80 --name mamma-mia-vis-front-end-cnt mamma-mia-vis-frontend
   ```

3. **Access the Application**:
   Open `http://localhost:8080/` in your browser.

---

## Running Unit Tests

Run unit tests via [Karma](https://karma-runner.github.io) and Jasmine:

```bash
npm test
```

To run Karma tests with coverage:
```bash
npm test -- --code-coverage
```

---

## Documentation Commands

This documentation site is managed with [MkDocs](https://www.mkdocs.org/) and the [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) theme.

### Serve Documentation Locally
To start a live-reloading documentation server:

```bash
mkdocs serve
```
Or use the npm script:
```bash
npm run docs:serve
```

Then visit:
👉 **`http://127.0.0.1:8000/`**

### Build Static Documentation
To build the HTML documentation site into the `site/` folder:

```bash
mkdocs build
```
Or using npm:
```bash
npm run docs:build
```

---

## Troubleshooting & Tips

??? question "Cesium Globe shows an error or black screen"
    - Verify that a valid Cesium Ion Access Token is configured in `webpack.config.js`.
    - Check your browser developer console (`F12`) for WebGL errors. Make sure hardware acceleration is enabled in your browser settings.

??? question "No telemetry data appears on selection"
    - Verify that the MAMMA MIA Backend service is running at `http://127.0.0.1:8040/`.
    - Make sure the dates selected in the datepicker fall within the date range of the chosen mission/deployment.
    - Check the network tab in browser developer tools for `zarr_trajectory` or `zarr_metrics` requests.

??? question "404 Not Found when reloading a deep route"
    - The development server is preconfigured with `historyApiFallback: true`.
    - For production deployments on Nginx, ensure `try_files $uri $uri/ /index.html;` is present in your server configuration (already handled in `nginx.conf`).
