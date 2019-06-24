const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
    host: '0.0.0.0',
    disableHostCheck: true
  },
  module: {
    rules: [
      {
        test: /\.glsl$/,
        loader: 'webpack-glsl-loader'
      }
    ]
  }
};