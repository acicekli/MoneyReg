import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../screens/SettingsScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import { fonts, useTheme } from '../theme';
import type { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.heading },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
      <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Kategoriler' }} />
    </Stack.Navigator>
  );
}
