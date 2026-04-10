import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solidregardless.squawk',
  appName: 'Squawk',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#e8f4fd', // matches --sq-bg-deep, fills safe area gap
  },
};

export default config;
