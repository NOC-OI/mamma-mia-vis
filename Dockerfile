# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Copy Cesium workers (as required by the webpack config or build process)
RUN npm run copy:workers

# Build for production using the custom webpack config
RUN npx webpack --mode=production --config webpack.config.js

# Serve stage
FROM nginx:stable-alpine

# Copy built files from build stage
COPY --from=build /app/public /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
