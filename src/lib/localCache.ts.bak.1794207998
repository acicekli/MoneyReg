// ============================================================
// MoneyReg — Basit yerel cache (AsyncStorage)
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'cache:';

export async function getCached<T = any>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCached(key: string, data: any): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // sessizce yut
  }
}

export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    // sessizce yut
  }
}

export async function clearCacheByPrefix(prefix: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter((k) => k.startsWith(PREFIX + prefix));
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    // sessizce yut
  }
}

// ---------- Cache key şeması ----------

export const CacheKeys = {
  homeTransactions: 'home:transactions',
  homeMonthly: 'home:monthly',
  homeDisplayName: 'home:displayName',
  groupsList: 'groups:list',
  groupDetail: (spaceId: string) => `group:${spaceId}:detail`,
  groupTransactions: (spaceId: string) => `group:${spaceId}:transactions`,
  categories: 'categories:user',
  reports: (scope: string, period: string) => `reports:${scope}:${period}`,
  allTransactionsRaw: 'all-transactions:raw',
  allTransactionsSpaces: 'all-transactions:spaces',
};
