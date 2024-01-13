// Webpack config linked to the main storybook webpack config "main.ts", this one is used for CesiumJS

const CopywebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const webpack = require('webpack');
const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';

module.exports = ({ config }) => {
  config.resolve = {
    ...config.resolve,
    fallback: {
      ...config.resolve.fallback,
      zlib: false,
      https: false,
      http: false,
    },
    alias: {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '../src'),
      '@assets': path.resolve(__dirname, '../src/assets'),
      '@components': path.resolve(__dirname, '../src/components'),
      '@utils': path.resolve(__dirname, '../src/utils'),
      '@types': path.resolve(__dirname, '../src/types'),

      'geoconfig': path.resolve(__dirname, '../src/geoconfig.ts'),
      'theme': path.resolve(__dirname, '../src/utils/constants/theme.constants.ts'),
    },
    extensions: ['.*', '.js', '.jsx', '.ts', '.tsx'],
  };

  config.module = {
    ...config.module,
    rules: [
      ...config.module.rules,
      {
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
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|xml|json)$/,
        type: 'asset',
      }
    ],
  };

  config.plugins = [
    ...config.plugins,
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
      minChunks: (module: { context: string | string[]; }) => module.context && module.context.indexOf('cesium') !== -1
    }),
  ];

  return config;
}