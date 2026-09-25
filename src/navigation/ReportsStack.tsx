import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ReportsScreen from '../screens/ReportsScreen';
import { fonts, useTheme } from '../theme';
import type { ReportsStackParamList } from './types';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export default function ReportsStack() {
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
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Raporlar' }} />
    </Stack.Navigator>
  );
}
