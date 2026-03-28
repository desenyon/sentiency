const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    content: './src/content/index.js',
    'service-worker': './src/background/service-worker.js',
    options: './src/options/Options.jsx',
    sidepanel: './src/sidepanel/Sidepanel.jsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'public', to: '.', noErrorOnMissing: true },
        { from: 'src/options/index.html', to: 'options.html' },
        { from: 'src/sidepanel/index.html', to: 'sidepanel.html' },
      ],
    }),
  ],
  optimization: {
    minimize: true,
  },
  // Extension bundles are allowed to exceed default web perf budgets; hide size "warnings"
  // so `npm run build` stays clean before reloading in chrome://extensions.
  performance: {
    hints: false,
  },
};
