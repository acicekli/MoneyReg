import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  AddExpense: { spaceId?: string; transactionId?: string } | undefined;
  AllTransactions: { spaceId?: string } | undefined;
};

export type GroupsStackParamList = {
  Groups: undefined;
  CreateSpace: undefined;
  GroupDetail: { spaceId: string };
  AllTransactions: { spaceId?: string } | undefined;
  CalculateModal: { spaceId: string };
  CalculateScreen: { spaceId: string };
  ClosingReport: { spaceId: string };
  PersonDetail: { spaceId: string; userId: string };
};

export type ReportsStackParamList = {
  Reports: { initialPeriod?: 'weekly' | 'monthly' | 'yearly' } | undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
  Categories: undefined;
};

export type MainTabParamList = {
  HomeTab:    NavigatorScreenParams<HomeStackParamList>;
  GroupsTab:  NavigatorScreenParams<GroupsStackParamList>;
  ReportsTab: NavigatorScreenParams<ReportsStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};
