// ============================================================
// MoneyReg — Admin: Feedback Yönetimi
// Sadece admin kullanıcılar erişebilir.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useTheme,
  useThemedStyles,
  fonts,
  radius,
  spacing,
  type ThemeColors,
} from '../theme';
import {
  getAllFeedback,
  deleteFeedback,
  type FeedbackItem,
} from '../lib/adminQueries';

type Filter = 'all' | 'bug' | 'feature' | 'other';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'bug', label: '🐞 Hata' },
  { value: 'feature', label: '💡 Öneri' },
  { value: 'other', label: '💬 Diğer' },
];

const CATEGORY_LABELS: Record<FeedbackItem['category'], string> = {
  bug: '🐞 Hata',
  feature: '💡 Öneri',
  other: '💬 Diğer',
};

function formatDateTR(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${m}.${y} ${hh}:${mm}`;
}

export default function AdminFeedbackScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    const list = await getAllFeedback();
    setItems(list);
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((f) => f.category === filter);
  }, [items, filter]);

  const handleDelete = useCallback(
    (item: FeedbackItem) => {
      Alert.alert(
        'Feedback\'i sil?',
        'Bu işlem geri alınamaz.',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: async () => {
              const res = await deleteFeedback(item.id);
              if (res.ok) {
                setItems((prev) => prev.filter((x) => x.id !== item.id));
              } else {
                Alert.alert('Silinemedi', res.error);
              }
            },
          },
        ]
      );
    },
    []
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {/* Filtre pill'leri */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text
                style={[styles.pillText, active && styles.pillTextActive]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Sayaç */}
      <Text style={styles.counter}>
        {filtered.length} kayıt
      </Text>

      {/* Boş durum */}
      {filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Feedback yok</Text>
          <Text style={styles.emptySub}>
            {filter === 'all'
              ? 'Henüz hiç geri bildirim gelmemiş.'
              : 'Bu kategoride kayıt bulunamadı.'}
          </Text>
        </View>
      ) : (
        filtered.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.categoryBadge}>
                {CATEGORY_LABELS[item.category]}
              </Text>
              <Pressable
                onPress={() => handleDelete(item)}
                hitSlop={8}
              >
                <Text style={styles.deleteBtn}>Sil</Text>
              </Pressable>
            </View>

            <Text style={styles.message}>{item.message}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaText} numberOfLines={1}>
                {item.email ?? 'bilinmeyen@kullanıcı'}
              </Text>
              <Text style={styles.metaText}>
                {item.platform ?? '—'} · {formatDateTR(item.created_at)}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
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

    // Filtre
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    pill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: colors.ink,
      backgroundColor: colors.surface,
    },
    pillActive: {
      backgroundColor: colors.accent,
    },
    pillText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
    pillTextActive: { color: colors.accentInk },

    counter: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.inkSoft,
      marginBottom: spacing.sm,
    },

    // Boş
    emptyBox: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.xl,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    emptyTitle: {
      fontFamily: fonts.heading,
      fontSize: 18,
      color: colors.ink,
    },
    emptySub: {
      color: colors.inkSoft,
      fontSize: 14,
      marginTop: spacing.xs,
      textAlign: 'center',
    },

    // Kart
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    categoryBadge: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.accent,
    },
    deleteBtn: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.expense,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },

    message: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.ink,
      lineHeight: 20,
      marginBottom: spacing.sm,
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: spacing.sm,
    },
    metaText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.inkSoft,
      flexShrink: 1,
    },
  });
