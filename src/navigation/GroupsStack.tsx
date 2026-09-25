import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import AllTransactionsModal from '../screens/AllTransactionsModal';
import CalculateModal from '../screens/CalculateModal';
import CalculateScreen from '../screens/CalculateScreen';
import ClosingReportScreen from '../screens/ClosingReportScreen';
import PersonDetailScreen from '../screens/PersonDetailScreen';
import CreateSpaceModal from '../screens/CreateSpaceModal';
import { fonts, useTheme } from '../theme';
import type { GroupsStackParamList } from './types';

const Stack = createNativeStackNavigator<GroupsStackParamList>();

export default function GroupsStack() {
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
      <Stack.Screen name="Groups"        component={GroupsScreen}        options={{ title: 'Gruplar' }} />
      <Stack.Screen
        name="CreateSpace"
        component={CreateSpaceModal}
        options={{ presentation: 'modal', title: 'Yeni Alan' }}
      />
      <Stack.Screen name="GroupDetail"   component={GroupDetailScreen}   options={{ title: 'Grup Detayı' }} />
      <Stack.Screen name="AddExpense"     component={AddExpenseScreen}     options={{ title: 'Harcama' }} />
      <Stack.Screen
        name="AllTransactions"
        component={AllTransactionsModal}
        options={{ presentation: 'modal', title: 'Tüm Harcamalar' }}
      />

      {/* ⋯ → Hesapla → modal (aktif space) */}
      <Stack.Screen
        name="CalculateModal"
        component={CalculateModal}
        options={{ presentation: 'modal', title: 'Bakiye Durumu' }}
      />

      {/* Kapanış raporundan açılan tam ekran bakiye */}
      <Stack.Screen
        name="CalculateScreen"
        component={CalculateScreen}
        options={{ title: 'Bakiye Durumu' }}
      />

      <Stack.Screen name="ClosingReport" component={ClosingReportScreen} options={{ title: 'Kapanış Raporu' }} />
      <Stack.Screen name="PersonDetail"  component={PersonDetailScreen}  options={{ title: 'Kişi Detayı' }} />
    </Stack.Navigator>
  );
}
