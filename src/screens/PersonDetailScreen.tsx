import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatExpenseAmount, formatAmount as fmtAmount, formatPercent } from '../lib/format';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  getPersonDetailData,
  type PersonDetailData,
} from '../lib/closingReportQueries';
import BackgroundSilhouette from '../components/BackgroundSilhouette';
import { colors, fonts, radius, spacing } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';
import TransactionList, {
  type TransactionListItem,
} from '../components/TransactionList';

type RouteT = RouteProp<GroupsStackParamList, 'PersonDetail'>;


export default function PersonDetailScreen() {
  const route = useRoute<RouteT>();
  const { spaceId, userId } = route.params;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PersonDetailData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await getPersonDetailData(spaceId, userId);
    setData(d);
    setLoading(false);
  }, [spaceId, userId]);

  useEffect(() => { load(); }, [load]);

  const listItems: TransactionListItem[] = useMemo(() => {
    if (!data) return [];
    return data.transactions.map((t) => ({
      ...t,
      payer_display_name: data.person.display_name,
      category_name: t.category_name ?? undefined,
      category_icon: t.category_icon ?? undefined,
    }));
  }, [data]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Kişi bulunamadı</Text>
      </View>
    );
  }

  const { space, person, totalTRY, categoryBreakdown } = data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BackgroundSilhouette type="person" />
      <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{person.initial}</Text>
        </View>
        <Text style={styles.name}>{person.display_name}</Text>
        <Text style={styles.subtitle}>
          {space.name} içindeki harcamaları · Toplam{' '}
          <Text style={styles.subtitleStrong}>{formatCurrency(totalTRY)}</Text>
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Kategoriye göre kırılım</Text>
      {categoryBreakdown.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptySub}>Bu kişinin harcaması yok.</Text>
        </View>
      ) : (
        <View style={styles.categoryBox}>
          {categoryBreakdown.map((c, idx) => (
            <View
              key={c.category_id ?? '__none__'}
              style={[
                styles.categoryRow,
                idx === categoryBreakdown.length - 1 && styles.categoryRowLast,
              ]}
            >
              <Text style={styles.categoryName}>
                {c.icon} {c.name}
              </Text>
              <Text style={styles.categoryValue}>{formatCurrency(c.total)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
        Tüm harcamalar
      </Text>
      <TransactionList
        transactions={listItems}
        showPayer={false}
        showCategory={true}
        emptyMessage="Bu kişinin harcaması yok."
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  header: { alignItems: 'center', marginBottom: spacing.lg },
  avatarLarge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarLargeText: {
    color: colors.accentInk, fontWeight: '700', fontSize: 24,
  },
  name: {
    fontFamily: fonts.heading, fontSize: 24, color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: { color: colors.inkSoft, fontSize: 14, textAlign: 'center' },
  subtitleStrong: { color: colors.ink, fontWeight: '700' },

  sectionTitle: {
    fontFamily: fonts.heading, fontSize: 16, color: colors.ink,
    marginBottom: spacing.sm,
  },

  categoryBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  categoryRowLast: { borderBottomWidth: 0 },
  categoryName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  categoryValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },

  emptyBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.xl, alignItems: 'center',
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },
  emptySub: { color: colors.inkSoft, fontSize: 14 },
});
