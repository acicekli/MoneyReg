import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatExpenseAmount, formatAmount as fmtAmount, formatPercent } from '../lib/format';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getClosingReportData,
  type ClosingReportData,
} from '../lib/closingReportQueries';
import { supabase } from '../lib/supabase';
import { type Category, type Transaction } from '../types/models';
import BackgroundSilhouette from '../components/BackgroundSilhouette';
import { colors, fonts, radius, spacing } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';
import TransactionList, {
  type TransactionListItem,
} from '../components/TransactionList';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'ClosingReport'>;
type RouteT = RouteProp<GroupsStackParamList, 'ClosingReport'>;


export default function ClosingReportScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { spaceId } = route.params;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ClosingReportData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [report, txRes, catRes] = await Promise.all([
      getClosingReportData(spaceId),
      supabase
        .from('transactions')
        .select('*')
        .eq('space_id', spaceId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('*'),
    ]);

    setData(report);
    setTransactions((txRes.data ?? []) as Transaction[]);
    setCategories((catRes.data ?? []) as Category[]);
    setLoading(false);
  }, [spaceId]);

  useEffect(() => { load(); }, [load]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const payerMap = useMemo(() => {
    const m = new Map<string, string>();
    if (data) for (const p of data.people) m.set(p.user_id, p.display_name);
    return m;
  }, [data]);

  const listItems: TransactionListItem[] = useMemo(() => {
    return transactions.map((t) => {
      const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
      return {
        ...t,
        payer_display_name: payerMap.get(t.created_by),
        category_name: cat?.name ?? (t.category_id ? null : 'Kategorisiz'),
        category_icon: cat?.icon ?? (t.category_id ? null : '📦'),
      };
    });
  }, [transactions, categoryMap, payerMap]);

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
        <Text style={styles.emptyTitle}>Rapor bulunamadı</Text>
      </View>
    );
  }

  const { space, totalTRY, people } = data;

  return (
    <View style={styles.root}>
      <BackgroundSilhouette type="airplane" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.spaceName} numberOfLines={1}>{space.name}</Text>
          <View style={styles.closedBadge}>
            <Text style={styles.closedBadgeText}>KAPANDI</Text>
          </View>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Toplam Harcama</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalTRY)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Kişi bazlı harcamalar</Text>
        {people.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptySub}>Bu alanda harcama yapılmadı.</Text>
          </View>
        ) : (
          people.map((p) => {
            const topStr = p.topCategories
              .map((c) => `${c.name} ${formatCurrency(c.total)}`)
              .join(' · ');
            const othersStr = p.othersCount > 0 ? ` · +${p.othersCount} diğer` : '';
            const summary =
              p.topCategories.length === 0
                ? 'harcama yok'
                : `${topStr}${othersStr}`;

            return (
              <Pressable
                key={p.user_id}
                style={({ pressed }) => [
                  styles.personCard,
                  pressed && styles.personCardPressed,
                ]}
                onPress={() =>
                  navigation.navigate('PersonDetail', {
                    spaceId,
                    userId: p.user_id,
                  })
                }
              >
                <View style={styles.personHeader}>
                  <View style={styles.personLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{p.initial}</Text>
                    </View>
                    <Text style={styles.personName}>{p.display_name}</Text>
                  </View>
                  <Text style={styles.personTotal}>{formatCurrency(p.totalTRY)}</Text>
                </View>
                <Text style={styles.personSummary} numberOfLines={2}>
                  {summary}
                </Text>
              </Pressable>
            );
          })
        )}

        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
          Tüm harcamalar
        </Text>
        <TransactionList
          transactions={listItems}
          showPayer={true}
          showCategory={true}
          emptyMessage="Bu alanda harcama yok."
        />
      </ScrollView>

      <Pressable
        style={styles.calcBtn}
        onPress={() => navigation.navigate('CalculateModal', { spaceId })}
      >
        <Text style={styles.calcBtnText}>Hesapla</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  scroll: { padding: spacing.lg, paddingBottom: 100 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.md,
  },
  spaceName: {
    fontFamily: fonts.heading, fontSize: 22, color: colors.ink,
    flex: 1, marginRight: spacing.sm,
  },
  closedBadge: {
    backgroundColor: colors.inkSoft, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: 4,
  },
  closedBadgeText: {
    color: colors.accentInk, fontSize: 16,
    fontFamily: fonts.body,
  },

  totalBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.lg, alignItems: 'center', marginBottom: spacing.lg,
  },
  totalLabel: { color: colors.inkSoft, fontSize: 13 },
  totalValue: {
    fontFamily: fonts.heading, fontSize: 36,
    color: colors.ink, marginTop: spacing.xs,
  },

  sectionTitle: {
    fontFamily: fonts.heading, fontSize: 16, color: colors.ink,
    marginBottom: spacing.sm,
  },

  personCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  personCardPressed: { backgroundColor: colors.surfaceAlt },
  personHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.xs,
  },
  personLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  personSummary: { color: colors.inkSoft, fontSize: 16, marginTop: 2 },

  emptyBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.xl, alignItems: 'center',
    fontFamily: fonts.body,
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },
  emptySub: { color: colors.inkSoft, fontSize: 14 },

  calcBtn: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  calcBtnText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
});
