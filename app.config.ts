import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'harcama-takip',
  slug: 'harcama-takip',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'harcamatakip',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.acicekli.harcamatakip',
  },
  android: {
    package: 'com.acicekli.harcamatakip',
    adaptiveIcon: {
      backgroundColor: '#ffffff',
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
  },
  plugins: ['expo-notifications', 'expo-font', 'expo-image-picker'],
  updates: {
    url: 'https://u.expo.dev/4601e525-c3d5-4cbf-991b-b6a38e1eb5b8',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: '4601e525-c3d5-4cbf-991b-b6a38e1eb5b8',
    },
  },
});
