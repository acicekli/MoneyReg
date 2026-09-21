import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { getCached, CacheKeys } from '../lib/localCache';
import {
  getFilteredTransactions,
  type TransactionPeriod,
  type TransactionScope,
} from '../lib/homeQueries';
import { getSpaceMembers, type SpaceMemberInfo } from '../lib/groupQueries';
import { transactionAmountInTRY, type Category, type Transaction } from '../types/models';
import TransactionList, { type TransactionListItem } from '../components/TransactionList';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { colors, fonts, radius, spacing } from '../theme';
import type { HomeStackParamList } from '../navigation/types';

type RouteT = RouteProp<HomeStackParamList, 'AllTransactions'>;
type Nav = NativeStackNavigationProp<HomeStackParamList, 'AllTransactions'>;

const PERIOD_OPTIONS: { value: TransactionPeriod; label: string }[] = [
  { value: 'all', label: 'Tüm' },
  { value: '1m', label: 'Son 1 Ay' },
  { value: '3m', label: 'Son 3 Ay' },
  { value: '1y', label: 'Son 1 Yıl' },
];

const SCOPE_OPTIONS: { value: TransactionScope; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'personal', label: 'Kişisel' },
  { value: 'groups', label: 'Gruplar' },
];

function findLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T
): string {
  return options.find((o) => o.value === value)?.label ?? '';
}

export default function AllTransactionsModal() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();

  const initialSpaceId = route.params?.spaceId;
  const isGroupMode = !!initialSpaceId;

  const [period, setPeriod] = useState<TransactionPeriod>('all');
  const [scope, setScope] = useState<TransactionScope>('all');

  // Kişi filtresi — çoklu seçim (boş = hepsi)
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [members, setMembers] = useState<SpaceMemberInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTx, setSelectedTx] = useState<TransactionListItem | null>(null);

  // Dropdown state
  const [periodOpen, setPeriodOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  // Kategorileri cache'ten al
  useEffect(() => {
    (async () => {
      const cachedCats = await getCached<Category[]>(CacheKeys.categories);
      if (cachedCats) setCategories(cachedCats);
    })();
  }, []);

  // Grup üyelerini al (sadece grup modunda)
  useEffect(() => {
    if (!isGroupMode || !initialSpaceId) return;
    (async () => {
      const mems = await getSpaceMembers(initialSpaceId);
      setMembers(mems);
    })();
  }, [isGroupMode, initialSpaceId]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getFilteredTransactions(
        user.id,
        scope,
        period,
        initialSpaceId,
        memberIds.length > 0 ? memberIds : undefined
      );
      setTransactions(data);
    } finally {
      setLoading(false);
    }
  }, [user, scope, period, initialSpaceId, memberIds]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const listItems: TransactionListItem[] = useMemo(() => {
    return transactions.map((t) => {
      const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
      const payer = members.find((m) => m.user_id === t.created_by);
      return {
        ...t,
        payer_display_name: payer?.display_name,
        category_name: cat?.name ?? (t.category_id ? null : 'Kategorisiz'),
        category_icon: cat?.icon ?? (t.category_id ? null : '📦'),
      };
    });
  }, [transactions, categoryMap, members]);

  const totalTRY = useMemo(() => {
    let sum = 0;
    for (const t of transactions) sum += transactionAmountInTRY(t);
    return sum;
  }, [transactions]);

  // Kişi dropdown etiketi
  const memberLabel =
    memberIds.length === 0
      ? 'Tümü'
      : memberIds.length === 1
      ? members.find((m) => m.user_id === memberIds[0])?.display_name ?? '1 kişi'
      : `${memberIds.length} kişi`;

  function toggleMember(userId: string) {
    setMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  return (
    <View style={styles.root}>
      {/* Dropdown butonları */}
      <View style={styles.dropdownRow}>
        <Pressable
          style={styles.dropdownBtn}
          onPress={() => setPeriodOpen(true)}
        >
          <View style={styles.dropdownBtnInner}>
            <Text style={styles.dropdownLabel}>Zaman</Text>
            <Text style={styles.dropdownValue}>
              {findLabel(PERIOD_OPTIONS, period)} ▾
            </Text>
          </View>
        </Pressable>

        {!isGroupMode && (
          <Pressable
            style={styles.dropdownBtn}
            onPress={() => setScopeOpen(true)}
          >
            <View style={styles.dropdownBtnInner}>
              <Text style={styles.dropdownLabel}>Kapsam</Text>
              <Text style={styles.dropdownValue}>
                {findLabel(SCOPE_OPTIONS, scope)} ▾
              </Text>
            </View>
          </Pressable>
        )}

        {isGroupMode && members.length > 0 && (
          <Pressable
            style={styles.dropdownBtn}
            onPress={() => setMembersOpen(true)}
          >
            <View style={styles.dropdownBtnInner}>
              <Text style={styles.dropdownLabel}>Kişiler</Text>
              <Text style={styles.dropdownValue} numberOfLines={1}>
                {memberLabel} ▾
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Toplam */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{transactions.length} harcama</Text>
        <Text style={styles.totalValue}>
          ₺{totalTRY.toLocaleString('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </View>

      {/* Liste */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <TransactionList
            transactions={listItems}
            showCategory={true}
            showPayer={true}
            emptyMessage="Bu kriterlerde harcama bulunamadı."
            onPress={(t) => setSelectedTx(t)}
            editable={true}
            currentUserId={user?.id}
            onEdit={(t) => {
              setSelectedTx(null);
              navigation.navigate('AddExpense', {
                spaceId: t.space_id,
                transactionId: t.id,
              });
            }}
            onDelete={(t) => {
              setTransactions((prev) => prev.filter((x) => x.id !== t.id));
            }}
          />
        )}
      </ScrollView>

      {/* Zaman dropdown modal */}
      <Modal
        visible={periodOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPeriodOpen(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setPeriodOpen(false)}
        >
          <View style={styles.dropdownSheet}>
            <Text style={styles.dropdownSheetTitle}>Zaman Aralığı</Text>
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setPeriod(opt.value);
                    setPeriodOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      active && styles.dropdownItemTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {active && <Text style={styles.dropdownCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Kapsam dropdown modal */}
      <Modal
        visible={scopeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setScopeOpen(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setScopeOpen(false)}
        >
          <View style={styles.dropdownSheet}>
            <Text style={styles.dropdownSheetTitle}>Kapsam</Text>
            {SCOPE_OPTIONS.map((opt) => {
              const active = scope === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setScope(opt.value);
                    setScopeOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      active && styles.dropdownItemTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {active && <Text style={styles.dropdownCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Kişiler dropdown modal (çoklu seçim) */}
      <Modal
        visible={membersOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMembersOpen(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setMembersOpen(false)}
        >
          <Pressable
            style={styles.dropdownSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.dropdownSheetTitle}>Kişiler</Text>

            <ScrollView style={{ maxHeight: 320 }}>
              {members.map((m) => {
                const active = memberIds.includes(m.user_id);
                return (
                  <Pressable
                    key={m.user_id}
                    style={styles.dropdownItem}
                    onPress={() => toggleMember(m.user_id)}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        active && styles.dropdownItemTextActive,
                      ]}
                    >
                      {m.display_name}
                    </Text>
                    {active && <Text style={styles.dropdownCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Alt butonlar */}
            <View style={styles.dropdownFooter}>
              <Pressable
                style={styles.dropdownFooterBtn}
                onPress={() => setMemberIds(members.map((m) => m.user_id))}
              >
                <Text style={styles.dropdownFooterText}>Tümü</Text>
              </Pressable>
              <Pressable
                style={styles.dropdownFooterBtn}
                onPress={() => setMemberIds([])}
              >
                <Text style={styles.dropdownFooterText}>Temizle</Text>
              </Pressable>
              <Pressable
                style={[styles.dropdownFooterBtn, styles.dropdownFooterPrimary]}
                onPress={() => setMembersOpen(false)}
              >
                <Text
                  style={[
                    styles.dropdownFooterText,
                    { color: colors.accentInk },
                  ]}
                >
                  Tamam
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <TransactionDetailModal
        visible={!!selectedTx}
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        onEdit={
          selectedTx?.created_by === user?.id
            ? () => {
                const tx = selectedTx;
                setSelectedTx(null);
                navigation.navigate('AddExpense', {
                  spaceId: tx.space_id,
                  transactionId: tx.id,
                });
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  dropdownRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  dropdownBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dropdownBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
  },
  dropdownValue: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },

  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dropdownSheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
  },
  dropdownSheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dropdownItemText: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  dropdownItemTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
  },
  dropdownCheck: {
    color: colors.accent,
    fontSize: 16,
    fontFamily: fonts.bodyBold,
  },

  dropdownFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: spacing.sm,
  },
  dropdownFooterBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  dropdownFooterPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dropdownFooterText: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  totalLabel: {
    color: colors.inkSoft,
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
  },
  totalValue: {
    color: colors.ink,
    fontFamily: fonts.heading,
    fontSize: 18,
  },

  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  center: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
});
