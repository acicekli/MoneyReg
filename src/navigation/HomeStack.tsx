import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import AllTransactionsModal from '../screens/AllTransactionsModal';
import { colors, fonts } from '../theme';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.heading },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa' }} />
      <Stack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{ presentation: 'modal', title: 'Harcama Ekle' }}
      />
      <Stack.Screen
        name="AllTransactions"
        component={AllTransactionsModal}
        options={{ presentation: 'modal', title: 'Tüm Harcamalar' }}
      />
    </Stack.Navigator>
  );
}
