# Mamma-Mia Visualisation

Virtual reality visualisation for testing marine autonomy strategies and its application to present and future monitoring systems.

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.6.

## Development server

Run `npm run start` for a dev server. Navigate to `http://localhost:8080/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `npm run build` to build the project. The build artifacts will be stored in the `public/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Docker

To build and run the application using Docker:

1.  **Build the Docker image**:
    ```bash
    docker build -t mamma-mia-vis-frontend .
    ```

2.  **Run the Docker container**:
    ```bash
    docker run -d -p 8080:80 --name mamma-mia-vis-front-end-cnt mamma-mia-vis-frontend
    ```

The application will be accessible at `http://localhost:8080`.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
