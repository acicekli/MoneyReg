// ============================================================
// MoneyReg — Bildirim tercihleri (aç/kapa)
// Cihazda AsyncStorage ile saklanır.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'moneyreg:notification-settings:v1';

export type NotificationSettings = {
  weeklyEnabled: boolean;
  monthlyEnabled: boolean;
  yearlyEnabled: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  weeklyEnabled: true,
  monthlyEnabled: true,
  yearlyEnabled: true,
};

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      weeklyEnabled: parsed?.weeklyEnabled ?? DEFAULT_SETTINGS.weeklyEnabled,
      monthlyEnabled: parsed?.monthlyEnabled ?? DEFAULT_SETTINGS.monthlyEnabled,
      yearlyEnabled: parsed?.yearlyEnabled ?? DEFAULT_SETTINGS.yearlyEnabled,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveNotificationSettings(
  settings: NotificationSettings
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // sessizce yut
  }
}
