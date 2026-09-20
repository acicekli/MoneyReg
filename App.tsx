import 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, Platform, View } from 'react-native';
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { AuthProvider, useAuth } from './src/lib/auth-context';
import { NetworkProvider, useNetworkStatus } from './src/lib/networkContext';
import { processQueue } from './src/lib/syncQueue';
import RootNavigator from './src/navigation/RootNavigator';
import {
  rescheduleAllNotifications,
  setupNotificationResponseHandler,
} from './src/lib/notifications';
import OfflineBanner from './src/components/OfflineBanner';
import { colors } from './src/theme';

// ---------- Bildirim bootstrap ----------

function NotificationBootstrap() {
  const { user } = useAuth();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    setupNotificationResponseHandler();
  }, []);

  useEffect(() => {
    if (!user) {
      lastUserIdRef.current = null;
      return;
    }
    if (Platform.OS === 'web') return;
    lastUserIdRef.current = user.id;
    rescheduleAllNotifications(user.id);
  }, [user]);

  return null;
}

// ---------- Offline → Online geçince kuyruğu işle ----------

function SyncOnOnline() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const prevOnlineRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user) return;
    if (isOnline && !prevOnlineRef.current) {
      processQueue(user.id).then((result) => {
        if (result.processed > 0) {
          console.log(`[sync] ${result.processed} işlem senkronize edildi.`);
        }
      });
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, user]);

  return null;
}

// ---------- App ----------

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <NotificationBootstrap />
          <SyncOnOnline />
          <OfflineBanner />
          <RootNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
