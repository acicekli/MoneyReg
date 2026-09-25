import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import { navigationRef } from './navigationRef';
import { useTheme } from '../theme';

export default function RootNavigator() {
  const { session, loading } = useAuth();
  const { colors, isDark } = useTheme();

  const navTheme: NavTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.bg,
        card: colors.surface,
        text: colors.ink,
        border: colors.line,
        notification: colors.expense,
      },
    };
  }, [colors, isDark]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {session ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
