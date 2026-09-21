import { useEffect, useState } from 'react';
import { formatCurrency, formatExpenseAmount, formatAmount as fmtAmount, formatPercent } from '../lib/format';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { getSpaceDetail, type BalanceEntry } from '../lib/groupDetailQueries';
import { colors, fonts, radius, spacing } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';

type RouteT = RouteProp<GroupsStackParamList, 'CalculateModal'>;


export default function CalculateModal() {
  const route = useRoute<RouteT>();
  const { spaceId } = route.params;
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [totalTRY, setTotalTRY] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const detail = await getSpaceDetail(spaceId);
      if (detail) {
        setBalances(detail.balances);
        setTotalTRY(detail.totalTRY);
      }
      setLoading(false);
    })();
  }, [spaceId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Bakiye Durumu</Text>
      <Text style={styles.subtitle}>
        Toplam harcama: <Text style={styles.totalValue}>{formatCurrency(totalTRY)}</Text>
      </Text>
      <Text style={styles.note}>
        Herkes eşit pay alır. Yeşil alacaklı, kırmızı borçlu.
      </Text>

      <View style={styles.list}>
        {balances.map((b) => {
          const positive = b.net >= 0;
          return (
            <View key={b.user_id} style={styles.row}>
              <View style={styles.left}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{b.initial}</Text>
                </View>
                <Text style={styles.name}>{b.display_name}</Text>
              </View>
              <View style={styles.right}>
                <Text
                  style={[
                    styles.netValue,
                    positive ? styles.netPositive : styles.netNegative,
                  ]}
                >
                  {positive ? '+' : ''}{formatCurrency(b.net)}
                </Text>
                <Text style={styles.subLine}>
                  ödedi: {formatCurrency(b.paid)} · payı: {formatCurrency(b.share)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  scroll: { padding: spacing.lg },
  title: {
    fontFamily: fonts.heading, fontSize: 22,
    color: colors.ink, marginBottom: spacing.xs,
  },
  subtitle: { color: colors.inkSoft, fontSize: 14, marginBottom: spacing.xs },
  totalValue: { color: colors.ink, fontWeight: '700' },
  note: { color: colors.inkSoft, fontSize: 12, marginBottom: spacing.md },

  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, padding: spacing.md,
    fontFamily: fonts.body,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.accentInk, fontWeight: '700', fontSize: 13 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  right: { alignItems: 'flex-end' },
  netValue: { fontSize: 16, fontWeight: '700' },
  netPositive: { color: colors.positive },
  netNegative: { color: colors.expense },
  subLine: { color: colors.inkSoft, fontSize: 11, marginTop: 2 },
});
