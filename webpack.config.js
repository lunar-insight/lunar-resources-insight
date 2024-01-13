const path = require('path');

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const CopywebpackPlugin = require('copy-webpack-plugin');

const fs = require('fs');

const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';

const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  context: __dirname,
  mode: 'development',
  devtool: 'eval',
  entry: {
    app: './src/index.tsx'
  },
  optimization: {
    runtimeChunk: 'single',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',

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
      '@': path.resolve(__dirname, 'src'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@components': path.resolve(__dirname, 'src/components'),
      'utils': path.resolve(__dirname, 'src/utils'),
      '@types': path.resolve(__dirname, 'src/types'),

      'geoconfig': path.resolve(__dirname, 'src/geoconfig.ts'),
      'theme': path.resolve(__dirname, 'src/utils/constants/theme.constants.ts'),
    },
    extensions: ['.*', '.js', '.jsx', '.ts', '.tsx'],
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
      test: /\.(ts|tsx)$/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            '@babel/preset-env',
            '@babel/react',
            '@babel/preset-typescript'
          ],
        },
      },
      exclude: /node_modules/,
    }, {
      test: /\.(js|jsx)$/,
      exclude: /node_modules/,
      use: ['babel-loader'],
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
    static: './dist',
    hot: true
  },
  node: {
    global: false,
    __filename: false,
    __dirname: false,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html',
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
    }),
    new webpack.HotModuleReplacementPlugin(),
  ]
};