const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = [
  // Service worker — must use target:'webworker' (no window global)
  {
    entry: {
      'background/service-worker': './src/background/service-worker.ts',
    },
    target: 'webworker',
    mode: 'production',
    module: {
      rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
    },
    resolve: { extensions: ['.ts', '.js'] },
    output: { path: path.resolve(__dirname, 'dist'), filename: '[name].js' },
  },

  // Content script + options page
  {
    entry: {
      'content/content': './src/content/content.ts',
      'options/options': './src/options/options.ts',
    },
    target: 'web',
    mode: 'production',
    module: {
      rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
    },
    resolve: { extensions: ['.ts', '.js'] },
    output: { path: path.resolve(__dirname, 'dist'), filename: '[name].js' },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'manifest.json', to: '.' },
          { from: 'public/icons', to: 'icons' },
          { from: 'src/options/options.html', to: 'options' },
        ],
      }),
    ],
  },
];
