const path = require('path');
const webpack = require("webpack");
const cesiumSource = "./node_modules/cesium/Build/Cesium";
const assetsSource = "./src/assets";
const cesiumBaseUrl = "cesium/static";
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { AngularWebpackPlugin } = require('@ngtools/webpack');

module.exports = {
    mode: 'development',
    entry: {
        'app': './src/main.ts',
        'vendor': ['bootstrap', 'cesium'],
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'public'),
        clean: true,
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
    rules: [
        {
            test: /\.js$/, 
            use: 'babel-loader',
            exclude: /node_modules/,
        },
        {
            test: /\.ts$/, 
            use: '@ngtools/webpack', // Use Angular Webpack loader for AOT compilation
            exclude: /node_modules/,
        },
        {
            test: /\.html$/,
            loader: 'html-loader'
        },
        {
            test: /\.css$/i,
            use: ['style-loader', 'css-loader'],
        },
        {
            test: /\.scss$/i,
            exclude: path.resolve(__dirname, 'src/styles.scss'),
            use: [
                'to-string-loader',
                // Translates CSS into CommonJS
                "css-loader",
                // Compiles Sass to CSS
                {
                    loader: "sass-loader",
                    options: {
                        sourceMap: true, // Necessary for resolve-url-loader
                        implementation: require("sass"),
                    },
                },
            ],
            include: path.resolve(__dirname, 'src/app'), // Only apply to Angular component styles
        },
        {
            test: /\.(scss)$/,
            include: path.resolve(__dirname, 'src/styles.scss'),
            use: [
              {
                loader: 'style-loader'
              },
              {
                loader: 'css-loader'
              },
              {
                loader: 'postcss-loader',
                options: {
                  postcssOptions: {
                    plugins: () => [
                      require('autoprefixer')
                    ]
                  }
                }
              },
              {
                loader: 'sass-loader'
              }
            ]
        },
        {
            test: /\.(png|svg|jpg|jpeg|gif|ico)$/i,
            type: 'asset/resource',
        },
        {
            test: /\.(woff|woff2|eot|ttf|otf)$/i,
            type: 'asset/resource',
        },
    ],
    },
    plugins: [
        new AngularWebpackPlugin({ // Enable AOT in Webpack
            tsconfig: './tsconfig.json',
            directTemplateLoading: true,
        }),
        new HtmlWebpackPlugin({
            template: './src/index.html',
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: path.join(cesiumSource, "Workers"), to: `${cesiumBaseUrl}/Workers`, },
                { from: path.join(cesiumSource, "ThirdParty"), to: `${cesiumBaseUrl}/ThirdParty`, },
                { from: path.join(cesiumSource, "Assets"), to: `${cesiumBaseUrl}/Assets`, },
                { from: path.join(cesiumSource, "Widgets"), to: `${cesiumBaseUrl}/Widgets`, },
                { from: path.join(assetsSource, "cesium-drone"), to: `${cesiumBaseUrl}/models`, },
            ],}),
        new webpack.DefinePlugin({
            // Define relative base path in cesium for loading assets
            CESIUM_BASE_URL: JSON.stringify(cesiumBaseUrl),
            'process.env': {
                ION_ACCESS_TOKEN: JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkM2FmMWY5Ny05M2ZkLTQ2MDgtYWRkNy0wMWM1MGVlZmI3NmMiLCJpZCI6MjQ3Njc5LCJpYXQiOjE3Mjg3Nzk5OTZ9.rwBWfMKsBsmEQilYYnWZJZnOOxdLh6lUmasNAQrF8oc')
            }
        }),
    ],
    devServer: {
        static: path.resolve(__dirname, 'public'), // Serve from public directory
        historyApiFallback: true, // This ensures index.html is served for all routes
        hot: true, // Enable Hot Module Replacement (HMR)
        port: 8080,
    },
};