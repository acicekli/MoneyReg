import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MoneyReg',
  slug: 'harcama-takip',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'harcamatakip',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.acicekli.harcamatakip',
    infoPlist: {
      // Standart HTTPS dışında özel şifreleme yok → her build'de ihracat uyumluluğu sorusu çıkmasın
      ITSAppUsesNonExemptEncryption: false,
    },
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
  plugins: [
    'expo-notifications',
    'expo-font',
    [
      'expo-image-picker',
      {
        cameraPermission: 'Fiş fotoğrafı çekmek için kameraya erişim gerekir.',
        photosPermission: 'Fiş fotoğrafı seçmek için fotoğraflarına erişim gerekir.',
      },
    ],
  ],
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
