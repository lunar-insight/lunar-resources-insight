import type { StorybookConfig } from "@storybook/react-webpack5";
import path from 'path';

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-onboarding",
    "@storybook/addon-interactions",
    "@storybook/addon-styling-webpack",
    ({
      name: "@storybook/addon-styling-webpack",

      options: {
        rules: [{
      test: /\.css$/,
      sideEffects: true,
      use: [
          require.resolve("style-loader"),
          {
              loader: require.resolve("css-loader"),
              options: {
                  // Want to add more CSS Modules options? Read more here: https://github.com/webpack-contrib/css-loader#modules
    modules: {
    auto: true,
    },
                  
              },
          },
      ],
    },{
      test: /\.s[ac]ss$/,
      sideEffects: true,
      use: [
          require.resolve("style-loader"),
          {
              loader: require.resolve("css-loader"),
              options: {
                  // Want to add more CSS Modules options? Read more here: https://github.com/webpack-contrib/css-loader#modules
    modules: {
    auto: true,
    },
                  importLoaders: 2,
              },
          },
          require.resolve("resolve-url-loader"),
          {
              loader: require.resolve("sass-loader"),
              options: {
                  // Want to add more Sass options? Read more here: https://webpack.js.org/loaders/sass-loader/#options
                  implementation: require.resolve("sass"),
                  sourceMap: true,
                  sassOptions: {},
              },
          },
      ],
    },],
      }
    }),
  ],
  framework: {
    name: "@storybook/react-webpack5",
    options: {
      builder: {
        useSWC: true,
      },
    },
  },
  docs: {
    autodocs: "tag",
  },
  webpackFinal: async (config) => {

    if (!config.resolve) {
      config.resolve = {};
    }

    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '../src'),
      '@assets': path.resolve(__dirname, '../src/assets'),
      '@components': path.resolve(__dirname, '../src/components'),
      '@utils': path.resolve(__dirname, '../src/utils'),
      '@types': path.resolve(__dirname, '../src/types'),

      'geoconfig': path.resolve(__dirname, '../src/geoconfig.ts'),
      'theme': path.resolve(__dirname, '../src/utils/constants/theme.constants.ts'),
    };
    return config;
  },
};
export default config;
