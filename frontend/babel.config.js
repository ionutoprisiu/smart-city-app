const path = require('path');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: [path.resolve(__dirname)],
        alias: {
          '@app': path.resolve(__dirname, 'src/app'),
          '@features': path.resolve(__dirname, 'src/features'),
          '@shared': path.resolve(__dirname, 'src/shared'),
          '@theme': path.resolve(__dirname, 'src/theme'),
        },
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
