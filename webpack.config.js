const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopywebpackPlugin = require('copy-webpack-plugin');
const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';
const dotenv = require('dotenv');
dotenv.config();

module.exports = (env, argv) => ({
  context: __dirname,
  mode: argv.mode || 'development',
  devtool: 'source-map',
  entry: {
    app: './src/index.tsx'
  },
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      cacheGroups: {
        cesium: {
          name: 'cesium',
          chunks: 'all',
          test: /cesium/i,
        }
      }
    }
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
      'assets': path.resolve(__dirname, 'src/assets'),
      'components': path.resolve(__dirname, 'src/components'),
      'utils': path.resolve(__dirname, 'src/utils'),
      'types': path.resolve(__dirname, 'src/types'),
      'hooks': path.resolve(__dirname, 'src/hooks'),
      'services': path.resolve(__dirname, 'src/services'),
      'pages': path.resolve(__dirname, 'src/pages'),
      'fonts': path.resolve(__dirname, 'src/fonts'),
      'geoConfigExporter': path.resolve(__dirname, 'src/geoConfigExporter'),
    },
    extensions: ['.*', '.js', '.jsx', '.ts', '.tsx'],
  },
  module: {
    rules: [{
      test: /\.css$/,
      use: ['style-loader', 'css-loader']
    }, {
      test: /\.module\.scss$/,
      use: [
        'style-loader', 
        {
          loader: 'css-loader',
          options: {
            modules: {
              namedExport: false, // Necessary for css-module V7+ breaking change to keep old behavior
              localIdentName: process.env.NODE_ENV === 'production'
                ? '[hash:base64:5]'
                : '[name]__[local]--[hash:base64:5]',
            },
          },
        },
        'sass-loader'
      ]
    }, {
    test: /\.scss$/,
    exclude: /\.module\.scss$/,
    use: [
      'style-loader',
      'css-loader',
      'sass-loader'
    ]
    }, {
      test: /\.(png|jpg|jpeg|gif|svg|xml)$/,
      type: 'asset',
    }, {
      test: /\.workers\.js$/,           // Cesium >1.100 workers files is now integrated in the main js bundle,
      use: { loader: 'worker-loader'}  // This transform the worker files into a web worker object to ensure correct loading
    }, {
      test: /\.(ts|tsx)$/,
      use: 'ts-loader',
      exclude: /node_modules/,
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
    hot: true,
    host: '127.0.0.1'
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
    new webpack.DefinePlugin({
      ...Object.keys(process.env).reduce((env, key) => {
        if (key !== 'NODE_ENV') env[`process.env.${key}`] = JSON.stringify(process.env[key]);
        return env;
      }, {})
      //'process.env.MAP_SERVER_URL': JSON.stringify(process.env.MAP_SERVER_URL),
    }),
    //new webpack.HotModuleReplacementPlugin(),
  ]
});