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
import { deleteTransaction } from '../lib/transactionQueries';
import { enqueue } from '../lib/offlineQueue';
import { useNetworkStatus } from '../lib/networkContext';
import { getCached, setCached, CacheKeys } from '../lib/localCache';
import { getAllTransactions, type TransactionPeriod, type TransactionScope } from '../lib/homeQueries';
import { getUserSpaces } from '../lib/transactionQueries';
import { getSpaceMembers, type SpaceMemberInfo } from '../lib/groupQueries';
import { transactionAmountInTRY, type Category, type Space, type Transaction } from '../types/models';
import TransactionList, { type TransactionListItem } from '../components/TransactionList';
import TransactionDetailModal from '../components/TransactionDetailModal';
import UndoToast from '../components/UndoToast';
import { fonts, radius, spacing, useThemedStyles, type ThemeColors, useTheme } from '../theme';
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

function getCutoffDate(period: TransactionPeriod): string | null {
  if (period === 'all') return null;
  const now = new Date();
  const d = new Date(now);
  if (period === '1m') d.setMonth(d.getMonth() - 1);
  else if (period === '3m') d.setMonth(d.getMonth() - 3);
  else if (period === '1y') d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export default function AllTransactionsModal() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { isOnline } = useNetworkStatus();

  const initialSpaceId = route.params?.spaceId;
  const isGroupMode = !!initialSpaceId;

  const [period, setPeriod] = useState<TransactionPeriod>('all');
  const [scope, setScope] = useState<TransactionScope>('all');

  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [members, setMembers] = useState<SpaceMemberInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [allRaw, setAllRaw] = useState<Transaction[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTx, setSelectedTx] = useState<TransactionListItem | null>(null);
  const [deletedTx, setDeletedTx] = useState<Transaction | null>(null);

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

  // Grup üyeleri (grup modunda)
  useEffect(() => {
    if (!isGroupMode || !initialSpaceId) return;
    (async () => {
      const mems = await getSpaceMembers(initialSpaceId);
      setMembers(mems);
    })();
  }, [isGroupMode, initialSpaceId]);

  // ============================================================
  // VERİ YÜKLEME (tek cache key: all-transactions:raw)
  // ============================================================
  const load = useCallback(async () => {
    if (!user) return;

    // 1) CACHE'ten oku
    const [cachedRaw, cachedSpaces, cachedCats] = await Promise.all([
      getCached<Transaction[]>(CacheKeys.allTransactionsRaw),
      getCached<Space[]>('all-transactions:spaces'),
      getCached<Category[]>(CacheKeys.categories),
    ]);

    if (cachedRaw) {
      setAllRaw(cachedRaw);
      setLoading(false);
    }
    if (cachedSpaces) setSpaces(cachedSpaces);
    if (cachedCats) setCategories(cachedCats);

    // 2) Offline ise cache ile kal
    if (!isOnline) {
      setLoading(false);
      return;
    }

    // 3) Online → çek + cache
    if (!cachedRaw) setLoading(true);
    try {
      const [rawData, spaceData, catData] = await Promise.all([
        getAllTransactions(user.id),
        getUserSpaces(user.id),
        (async () => {
          const { data } = await (await import('../lib/supabase')).supabase
            .from('categories')
            .select('*');
          return (data ?? []) as Category[];
        })(),
      ]);
      setAllRaw(rawData);
      setSpaces(spaceData);
      setCategories(catData);

      await Promise.all([
        setCached(CacheKeys.allTransactionsRaw, rawData),
        setCached('all-transactions:spaces', spaceData),
        setCached(CacheKeys.categories, catData),
      ]);
    } finally {
      setLoading(false);
    }
  }, [user, isOnline]);

  useEffect(() => {
    load();
  }, [load]);

  // ============================================================
  // LOCAL FILTER (Supabase'e gitmez — JS'te uygulanır)
  // ============================================================
  const spaceById = useMemo(() => {
    const m = new Map<string, Space>();
    for (const s of spaces) m.set(s.id, s);
    return m;
  }, [spaces]);

  const filtered = useMemo(() => {
    let result = allRaw;

    // 1) Grup modu → sadece o space
    if (initialSpaceId) {
      result = result.filter((t) => t.space_id === initialSpaceId);
    } else {
      // 2) Scope filtresi (genel mod)
      if (scope === 'personal') {
        result = result.filter((t) => {
          const s = spaceById.get(t.space_id);
          return s?.type === 'personal';
        });
      } else if (scope === 'groups') {
        result = result.filter((t) => {
          const s = spaceById.get(t.space_id);
          return s?.type === 'shared';
        });
      }
      // scope === 'all' → hepsi
    }

    // 3) Period filtresi
    const cutoff = getCutoffDate(period);
    if (cutoff) {
      result = result.filter((t) => t.expense_date >= cutoff);
    }

    // 4) Member filtresi (grup modu)
    if (isGroupMode && memberIds.length > 0) {
      result = result.filter((t) => memberIds.includes(t.created_by));
    }

    return result;
  }, [allRaw, scope, period, memberIds, initialSpaceId, isGroupMode, spaceById]);

  // Görüntülenecek harcamalar (silinen hariç)
  const displayList = useMemo(() => {
    if (!deletedTx) return filtered;
    return filtered.filter((t) => t.id !== deletedTx.id);
  }, [filtered, deletedTx]);

  // ============================================================
  // LİSTE HAZIRLAMA
  // ============================================================
  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const listItems: TransactionListItem[] = useMemo(() => {
    return displayList.map((t) => {
      const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
      const payer = members.find((m) => m.user_id === t.created_by);
      return {
        ...t,
        payer_display_name: payer?.display_name,
        category_name: cat?.name ?? (t.category_id ? null : 'Kategorisiz'),
        category_icon: cat?.icon ?? (t.category_id ? null : '📦'),
      };
    });
  }, [displayList, categoryMap, members]);

  const totalTRY = useMemo(() => {
    let sum = 0;
    for (const t of displayList) sum += transactionAmountInTRY(t);
    return sum;
  }, [displayList]);

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
        <Text style={styles.totalLabel}>{displayList.length} harcama</Text>
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
              setDeletedTx(t as any);
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

      {/* Kişiler dropdown modal */}
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

      {/* Detay modal */}
      <TransactionDetailModal
        visible={!!selectedTx}
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        onEdit={
          selectedTx && selectedTx.created_by === user?.id
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

      {/* Undo toast */}
      <UndoToast
        visible={!!deletedTx}
        message="Harcama silindi"
        bottomOffset={16}
        onUndo={() => {
          setDeletedTx(null);
        }}
        onExpire={async () => {
          if (deletedTx && user) {
            if (isOnline) {
              await deleteTransaction(user.id, deletedTx.id);
            } else {
              await enqueue('delete_transaction', {
                transactionId: deletedTx.id,
              });
            }
            // Cache'ten de sil
            const updated = allRaw.filter((t) => t.id !== deletedTx.id);
            setAllRaw(updated);
            await setCached(CacheKeys.allTransactionsRaw, updated);
            setDeletedTx(null);
          }
        }}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

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
    backgroundColor: colors.surface2,
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
