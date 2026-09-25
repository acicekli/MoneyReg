import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import {
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from '../lib/notificationSettings';
import { rescheduleAllNotifications } from '../lib/notifications';
import { getMonthStartDaySetting } from '../lib/reportsQueries';
import MonthStartDayModal from '../components/MonthStartDayModal';
import { fonts, radius, spacing, useTheme, type ThemeMode } from '../theme';
import type { SettingsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<SettingsStackParamList, 'Settings'>;

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Açık' },
  { value: 'dark', label: 'Koyu' },
  { value: 'system', label: 'Sistem' },
];

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<Nav>();
  const { colors, mode, setMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    weeklyEnabled: true,
    monthlyEnabled: true,
    yearlyEnabled: true,
  });

  const [monthStartDay, setMonthStartDay] = useState(1);
  const [dayModalOpen, setDayModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [s, day] = await Promise.all([
        loadNotificationSettings(),
        getMonthStartDaySetting(user.id),
      ]);
      setSettings(s);
      setMonthStartDay(day);
      setLoading(false);
    })();
  }, [user]);

  const updateSetting = useCallback(
    async (key: keyof NotificationSettings, value: boolean) => {
      const next = { ...settings, [key]: value };
      setSettings(next);
      await saveNotificationSettings(next);
      if (user) await rescheduleAllNotifications(user.id);
    },
    [settings, user]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        center: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        },
        scroll: {
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          backgroundColor: colors.bg,
          flexGrow: 1,
        },

        section: { marginBottom: spacing.lg },
        sectionTitle: {
          fontFamily: fonts.heading,
          fontSize: 16,
          color: colors.ink,
          marginBottom: spacing.sm,
        },

        card: {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.line,
          padding: spacing.md,
        },
        cardLabel: { color: colors.inkSoft, fontSize: 12 },
        cardValue: { color: colors.ink, fontSize: 15, marginTop: 2 },

        rowCard: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.line,
          padding: spacing.md,
          fontFamily: fonts.body,
        },
        rowCardPressed: { backgroundColor: colors.surface2 },

        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.sm,
        },
        rowText: { flex: 1, marginRight: spacing.md },
        rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
        rowSub: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },

        rowValue: {
          fontFamily: fonts.heading,
          fontSize: 22,
          color: colors.accent,
          marginLeft: spacing.md,
        },

        divider: {
          height: 1,
          backgroundColor: colors.line,
          marginVertical: spacing.xs,
        },

        // Tema seçici segment
        segmentRow: {
          flexDirection: 'row',
          backgroundColor: colors.surface2,
          borderRadius: radius.md,
          padding: 4,
          gap: 4,
        },
        segmentBtn: {
          flex: 1,
          paddingVertical: spacing.sm,
          borderRadius: radius.sm,
          alignItems: 'center',
        },
        segmentBtnActive: { backgroundColor: colors.accent },
        segmentText: {
          color: colors.ink,
          fontSize: 13,
          fontWeight: '600',
          fontFamily: fonts.body,
        },
        segmentTextActive: { color: colors.accentInk },

        logoutBtn: {
          backgroundColor: colors.expense,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          alignItems: 'center',
          marginTop: spacing.lg,
        },
        logoutBtnText: {
          color: colors.accentInk,
          fontSize: 16,
          fontFamily: fonts.body,
        },
      }),
    [colors]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hesap */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap</Text>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>E-posta</Text>
            <Text style={styles.cardValue}>{user?.email ?? '—'}</Text>
          </View>
        </View>

        {/* Görünüm */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Görünüm</Text>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Tema</Text>
            <View style={[styles.segmentRow, { marginTop: spacing.sm }]}>
              {THEME_OPTIONS.map((opt) => {
                const active = mode === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setMode(opt.value)}
                    style={[
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Rapor */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rapor</Text>

          <Pressable
            onPress={() => setDayModalOpen(true)}
            style={({ pressed }) => [
              styles.rowCard,
              pressed && styles.rowCardPressed,
            ]}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Ay başı günü</Text>
              <Text style={styles.rowSub}>
                Aylık raporun başlangıç günü
              </Text>
            </View>
            <Text style={styles.rowValue}>{monthStartDay}</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Categories')}
            style={({ pressed }) => [
              styles.rowCard,
              pressed && styles.rowCardPressed,
              { marginTop: spacing.sm },
            ]}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Kategoriler</Text>
              <Text style={styles.rowSub}>
                Kendi kategorilerini ekle, düzenle
              </Text>
            </View>
            <Text style={styles.rowValue}>›</Text>
          </Pressable>
        </View>

        {/* Bildirimler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirimler</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Haftalık rapor</Text>
                <Text style={styles.rowSub}>Her Pazar 20:00</Text>
              </View>
              <Switch
                value={settings.weeklyEnabled}
                onValueChange={(v) => updateSetting('weeklyEnabled', v)}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Aylık rapor</Text>
                <Text style={styles.rowSub}>Ayın son günü 21:00</Text>
              </View>
              <Switch
                value={settings.monthlyEnabled}
                onValueChange={(v) => updateSetting('monthlyEnabled', v)}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Yıllık rapor</Text>
                <Text style={styles.rowSub}>31 Aralık 12:00</Text>
              </View>
              <Switch
                value={settings.yearlyEnabled}
                onValueChange={(v) => updateSetting('yearlyEnabled', v)}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>
          </View>
        </View>

        {/* Çıkış */}
        <Pressable style={styles.logoutBtn} onPress={signOut}>
          <Text style={styles.logoutBtnText}>Çıkış Yap</Text>
        </Pressable>
      </ScrollView>

      <MonthStartDayModal
        visible={dayModalOpen}
        currentDay={monthStartDay}
        onClose={() => setDayModalOpen(false)}
        onSaved={(newDay) => setMonthStartDay(newDay)}
      />
    </>
  );
}
