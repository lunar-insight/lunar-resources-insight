const path = require('path');

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const CopywebpackPlugin = require('copy-webpack-plugin');

const fs = require('fs');

const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';

const periodicTableHtmlContent = fs.readFileSync('./src/components/tabs/elements/periodic-table/periodic-table.html', 'utf8');
const tabsElementsHtmlContent = fs.readFileSync('./src/components/tabs/elements/elements.html', 'utf-8');

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

      // Main
      cesium: path.resolve(__dirname, cesiumSource),
      images: path.resolve(__dirname, 'src/image/'),
      index$: path.resolve(__dirname,'src/index.js'),
      config$: path.resolve(__dirname,'src/config.js'),
      colorbrewer$: path.resolve(__dirname, 'src/constants/colorbrewer.js'),
      tooltip$: path.resolve(__dirname, 'src/functions/tooltip.js'),

      // Tabs
      elementTab: path.resolve(__dirname, 'src/components/tabs/elements/'),

      // Element layer management
      updateElementLayer$: path.resolve(__dirname, 'src/components/tabs/elements/element-layer-management/update-element-layer.js'),
      deselectElementLayer$: path.resolve(__dirname, 'src/components/tabs/elements/element-layer-management/layer-deselection.js'),
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
      test: /\.(png|jpg|jpeg|gif|svg|xml|json)$/,
      type: 'asset',
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
        periodicTableContent: periodicTableHtmlContent,
        tabsElementsContent: tabsElementsHtmlContent
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
      'process.env.MAP_SERVER_URL': JSON.stringify(process.env.MAP_SERVER_URL),
    })
  ]
};