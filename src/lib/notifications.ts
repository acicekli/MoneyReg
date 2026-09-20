// ============================================================
// MoneyReg — Lokal bildirimler
// Sadece 3 tür: haftalık / aylık / yıllık rapor bildirimleri.
// "Harcama girmedin" tarzı hatırlatma YOKTUR.
// ============================================================

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { loadNotificationSettings } from './notificationSettings';
import { transactionAmountInTRY, type Transaction } from '../types/models';
import { navigationRef } from '../navigation/navigationRef';

// ---------- Bildirim handler'ı ----------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ---------- İzinler ----------

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ---------- Yardımcılar ----------

async function getTotalTRYForRange(
  userId: string,
  startISO: string,
  endISO: string
): Promise<number> {
  const { data: memberRows } = await supabase
    .from('space_members')
    .select('space:spaces ( id )')
    .eq('user_id', userId);

  const spaceIds: string[] = [];
  for (const row of (memberRows ?? []) as any[]) {
    const s = row.space;
    if (!s) continue;
    if (Array.isArray(s)) for (const x of s) spaceIds.push(x.id);
    else spaceIds.push(s.id);
  }

  if (spaceIds.length === 0) return 0;

  const { data: txRows } = await supabase
    .from('transactions')
    .select('*')
    .in('space_id', spaceIds)
    .eq('created_by', userId)
    .gte('expense_date', startISO)
    .lte('expense_date', endISO);

  const transactions = (txRows ?? []) as Transaction[];
  let total = 0;
  for (const t of transactions) total += transactionAmountInTRY(t);
  return total;
}

// ---------- Tarih hesaplamaları ----------

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getThisWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return { start: toISODate(monday), end: toISODate(now) };
}

function getThisMonthRange(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: toISODate(first), end: toISODate(now) };
}

function getThisYearRange(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), 0, 1);
  return { start: toISODate(first), end: toISODate(now) };
}

// ---------- Bir sonraki tetiklenme tarihi ----------

function getNextSunday20(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = (7 - day) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilSunday);
  next.setHours(20, 0, 0, 0);
  return next;
}

function getNextMonthEnd21(): Date {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  lastDay.setHours(21, 0, 0, 0);
  if (lastDay.getTime() > now.getTime()) return lastDay;
  const nextMonthLast = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  nextMonthLast.setHours(21, 0, 0, 0);
  return nextMonthLast;
}

function getNextDec31_12(): Date {
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), 11, 31, 12, 0, 0, 0);
  if (thisYear.getTime() > now.getTime()) return thisYear;
  const nextYear = new Date(now.getFullYear() + 1, 11, 31, 12, 0, 0, 0);
  return nextYear;
}

// ---------- İptal ----------

const TAG_WEEKLY = 'weekly-report';
const TAG_MONTHLY = 'monthly-report';
const TAG_YEARLY = 'yearly-report';

export async function cancelAllReportNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ---------- Planlama ----------

export async function rescheduleAllNotifications(
  userId: string
): Promise<void> {
  if (Platform.OS === 'web') return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await cancelAllReportNotifications();

  const settings = await loadNotificationSettings();

  if (settings.weeklyEnabled) {
    try {
      const { start, end } = getThisWeekRange();
      const total = await getTotalTRYForRange(userId, start, end);
      await Notifications.scheduleNotificationAsync({
        identifier: TAG_WEEKLY,
        content: {
          title: 'Haftalık Rapor',
          body: `Bu hafta ₺${total.toFixed(2)} harcadın. Detaylar için dokun.`,
          data: { period: 'weekly', screen: 'Reports' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: getNextSunday20(),
        },
      });
    } catch {
      // sessiz
    }
  }

  if (settings.monthlyEnabled) {
    try {
      const { start, end } = getThisMonthRange();
      const total = await getTotalTRYForRange(userId, start, end);
      await Notifications.scheduleNotificationAsync({
        identifier: TAG_MONTHLY,
        content: {
          title: 'Aylık Rapor',
          body: `Bu ay ₺${total.toFixed(2)} harcadın. Detaylar için dokun.`,
          data: { period: 'monthly', screen: 'Reports' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: getNextMonthEnd21(),
        },
      });
    } catch {
      // sessiz
    }
  }

  if (settings.yearlyEnabled) {
    try {
      const { start, end } = getThisYearRange();
      const total = await getTotalTRYForRange(userId, start, end);
      await Notifications.scheduleNotificationAsync({
        identifier: TAG_YEARLY,
        content: {
          title: 'Yıllık Rapor',
          body: `Bu yıl ₺${total.toFixed(2)} harcadın. Detaylar için dokun.`,
          data: { period: 'yearly', screen: 'Reports' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: getNextDec31_12(),
        },
      });
    } catch {
      // sessiz
    }
  }
}

// ============================================================
// BİLDİRİM RESPONSE HANDLER'I
// Bildirime dokunulunca ReportsScreen'e ilgili periyotla git
// ============================================================

type NotificationPeriod = 'weekly' | 'monthly' | 'yearly';

function isValidPeriod(p: any): p is NotificationPeriod {
  return p === 'weekly' || p === 'monthly' || p === 'yearly';
}

function navigateToReports(period: NotificationPeriod) {
  if (!navigationRef.isReady()) {
    // Navigation hazır değilse 500ms sonra tekrar dene
    setTimeout(() => navigateToReports(period), 500);
    return;
  }

  try {
    navigationRef.navigate('ReportsTab' as never, {
      screen: 'Reports',
      params: { initialPeriod: period },
    } as never);
  } catch {
    // sessiz
  }
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse | null
) {
  if (!response) return;

  const data = response.notification.request.content.data as any;
  const period = data?.period;

  if (isValidPeriod(period)) {
    navigateToReports(period);
  }
}

let isHandlerSetup = false;

/**
 * Uygulama açılışında bir kez çağrılır.
 * - Cold start: getLastNotificationResponseAsync
 * - Runtime: addNotificationResponseReceivedListener
 */
export async function setupNotificationResponseHandler(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (isHandlerSetup) return;
  isHandlerSetup = true;

  // 1) Cold start — uygulama kapalıyken bildirime dokunuldu
  try {
    const lastResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastResponse) {
      // Küçük bir gecikme: navigation henüz mount olmamış olabilir
      setTimeout(() => handleNotificationResponse(lastResponse), 800);
    }
  } catch {
    // sessiz
  }

  // 2) Runtime — uygulama açıkken bildirime dokunuldu
  Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationResponse(response);
  });
}
