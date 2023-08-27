const path = require('path');

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const CopywebpackPlugin = require('copy-webpack-plugin');

const fs = require('fs');

const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';

const periodicTableHtmlContent = fs.readFileSync('./src/functions/periodic-table/periodic-table.html', 'utf8');

const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  context: __dirname,
  mode: 'development',
  devtool: 'eval',
  entry: {
    app: './src/index.js'
  },
  optimization: {
    runtimeChunk: 'single',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),

    // Needed to compile multiline strings in Cesium
    sourcePrefix: ''
  },
  amd: {
    // Enable webpack-friendly use of require in Cesium
    toUrlUndefined: true
  },
  resolve: {
    fallback: {
      url: false,
      zlib: false,
      https: false,
      http: false,
    },
    alias: {
      // CesiumJS module name
      cesium: path.resolve(__dirname, cesiumSource)
    },
  },
  module: {
    rules: [{
      test: /\.css$/,
      use: ['style-loader', 'css-loader']
    }, {
      test: /\.scss$/,
      use: ['style-loader', 'css-loader', 'sass-loader']
    }, {
      test: /\.(png|gif|jpg|jpeg|svg|xml|json)$/,
      use: ['url-loader']
    }, {
      // Strip cesium pragmas
      test: /\.js$/,
      enforce: 'pre',
      include: path.resolve(__dirname, cesiumSource),
      use: [{
        loader: 'strip-pragma-loader',
        options: {
          pragmas: {
            debug: false
          }
        }
      }]
    }]
  },
  devServer: {
    static: './dist'
  },
  node: {
    global: false,
    __filename: false,
    __dirname: false,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      templateParameters: {
        periodicTableContent: periodicTableHtmlContent
      }
    }),
    // Copy Cesium Assets, Widgets, and Workers to a static directory
    new CopywebpackPlugin({
      patterns: [
        { from: path.join(cesiumSource, cesiumWorkers), to: 'Workers' },
        { from: path.join(cesiumSource, 'Assets'), to: 'Assets' },
        { from: path.join(cesiumSource, 'Widgets'), to: 'Widgets' }
      ]
    }),
    new webpack.DefinePlugin({
      // Define relative base path in cesium for loading assets
      CESIUM_BASE_URL: JSON.stringify('')
    }),
    new webpack.optimize.SplitChunksPlugin({
      name: 'cesium',
      minChunks: module => module.context && module.context.indexOf('cesium') !== -1
    }),
    new webpack.DefinePlugin({
      'process.env.CESIUM_ION_ACCESS_TOKEN': JSON.stringify(process.env.CESIUM_ION_ACCESS_TOKEN),
    })
  ]
};