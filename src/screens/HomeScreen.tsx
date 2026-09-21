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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { useNetworkStatus } from '../lib/networkContext';
import { getCached, setCached, CacheKeys } from '../lib/localCache';
import { getQueue } from '../lib/offlineQueue';
import { onSyncComplete } from '../lib/syncEvents';
import { getCurrentExchangeRate, type CurrencyCode } from '../lib/exchangeRate';
import {
  getCategories,
  getCurrentMonthStart,
  getMonthlyTransactions,
  getPersonalSpaceId,
  getProfileDisplayName,
  getRecentTransactions,
  mapCategoriesById,
} from '../lib/homeQueries';
import { deleteTransaction } from '../lib/transactionQueries';
import {
  transactionAmountInTRY,
  type Category,
  type Transaction,
} from '../types/models';
import BackgroundSilhouette from '../components/BackgroundSilhouette';
import { colors, fonts, radius, spacing } from '../theme';
import type { HomeStackParamList } from '../navigation/types';
import TransactionList, {
  type TransactionListItem,
} from '../components/TransactionList';
import TransactionDetailModal from '../components/TransactionDetailModal';
import UndoToast from '../components/UndoToast';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

type ViewCurrency = 'TRY' | CurrencyCode;

export default function HomeScreen() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [monthly, setMonthly] = useState<Transaction[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [viewCurrency, setViewCurrency] = useState<ViewCurrency>('TRY');
  const [usdRate, setUsdRate] = useState<number | null>(null);
  const [eurRate, setEurRate] = useState<number | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [deletedTx, setDeletedTx] = useState<Transaction | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionListItem | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;

    // 1) Cache'ten oku — varsa hemen göster
    const [cachedRecent, cachedMonthly, cachedName, cachedSpaceId, cachedCats] =
      await Promise.all([
        getCached<Transaction[]>(CacheKeys.homeTransactions),
        getCached<Transaction[]>(CacheKeys.homeMonthly),
        getCached<string>(CacheKeys.homeDisplayName),
        getCached<string>(CacheKeys.homeDisplayName + ':spaceId'),
        getCached<Category[]>(CacheKeys.categories),
      ]);

    if (cachedName) setDisplayName(cachedName);
    if (cachedSpaceId) setSpaceId(cachedSpaceId);
    if (cachedCats) setCategories(cachedCats);
    if (cachedRecent) setRecent(cachedRecent);
    if (cachedMonthly) setMonthly(cachedMonthly);

    // Cache'ten bir şey geldiyse loading'i kapat (stale göster)
    const hasCache =
      cachedRecent !== null || cachedMonthly !== null || cachedCats !== null;
    if (hasCache) setLoading(false);

    // 2) Offline ise cache ile kal + kuyruktaki pending harcamaları göster
    if (!isOnline) {
      // Kuyruktaki create_transaction'ları geçici göster
      const queue = await getQueue();
      const pendingCreates: Transaction[] = queue
        .filter((q) => q.type === 'create_transaction')
        .map((q) => {
          const p = q.payload;
          return {
            id: p.id,
            space_id: p.space_id,
            created_by: user.id,
            amount: p.amount,
            currency: p.currency,
            exchange_rate_snapshot: p.exchange_rate_snapshot ?? null,
            category_id: p.category_id,
            note: p.note ?? null,
            expense_date: p.expense_date,
            receipt_photo_url: p.receiptLocalUri ?? p.receipt_photo_url ?? null,
            created_at: new Date(q.createdAt).toISOString(),
            updated_at: new Date(q.createdAt).toISOString(),
          } as Transaction;
        });

      if (pendingCreates.length > 0) {
        setRecent((prev) => {
          const existingIds = new Set(prev.map((x) => x.id));
          const newOnes = pendingCreates.filter((p) => !existingIds.has(p.id));
          return [...newOnes, ...prev];
        });
      }

      setLoading(false);
      return;
    }

    // 3) Online → Supabase'den çek, cache'i güncelle
    if (!hasCache) setLoading(true);
    setRateError(null);

    try {
      const [name, sid, cats] = await Promise.all([
        getProfileDisplayName(user.id),
        getPersonalSpaceId(user.id),
        getCategories(user.id),
      ]);

      setDisplayName(name);
      setSpaceId(sid);
      setCategories(cats);
      await Promise.all([
        setCached(CacheKeys.homeDisplayName, name),
        setCached(CacheKeys.homeDisplayName + ':spaceId', sid),
        setCached(CacheKeys.categories, cats),
      ]);

      if (sid) {
        const monthStart = getCurrentMonthStart();
        const [monthlyData, recentData] = await Promise.all([
          getMonthlyTransactions(sid, monthStart),
          getRecentTransactions(sid, 15),
        ]);
        setMonthly(monthlyData);
        setRecent(recentData);
        await Promise.all([
          setCached(CacheKeys.homeMonthly, monthlyData),
          setCached(CacheKeys.homeTransactions, recentData),
        ]);
      } else {
        setMonthly([]);
        setRecent([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, isOnline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Sync tamamlanınca verileri yenile
  useEffect(() => {
    const unsubscribe = onSyncComplete(() => {
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [usd, eur] = await Promise.all([
          getCurrentExchangeRate('USD'),
          getCurrentExchangeRate('EUR'),
        ]);
        if (!cancelled) {
          setUsdRate(usd);
          setEurRate(eur);
        }
      } catch (e: any) {
        if (!cancelled) setRateError(e?.message ?? 'Kur bilgisi alınamadı.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalTRY = useMemo(() => {
    let sum = 0;
    for (const t of monthly) sum += transactionAmountInTRY(t);
    return sum;
  }, [monthly]);

  const displayTotal = useMemo<{ value: number; symbol: string }>(() => {
    if (viewCurrency === 'TRY') return { value: totalTRY, symbol: '₺' };
    if (viewCurrency === 'USD') {
      if (usdRate == null) return { value: 0, symbol: '$' };
      return { value: totalTRY / usdRate, symbol: '$' };
    }
    if (eurRate == null) return { value: 0, symbol: '€' };
    return { value: totalTRY / eurRate, symbol: '€' };
  }, [viewCurrency, totalTRY, usdRate, eurRate]);

  const categoryMap = useMemo(() => mapCategoriesById(categories), [categories]);

  // TransactionList items
  const listItems: TransactionListItem[] = useMemo(() => {
    return recent.map((t) => {
      const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
      return {
        ...t,
        category_name: cat?.name ?? (t.category_id ? null : 'Kategorisiz'),
        category_icon: cat?.icon ?? (t.category_id ? null : '📦'),
      };
    });
  }, [recent, categoryMap]);

  function formatDisplayTotal(): string {
    return formatCurrency(displayTotal.value, viewCurrency as 'TRY' | 'USD' | 'EUR');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!spaceId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Kişisel alan bulunamadı</Text>
        <Text style={styles.emptySub}>Lütfen tekrar giriş yap.</Text>
      </View>
    );
  }

  const hasData = monthly.length > 0;

  return (
    <View style={styles.container}>
      <BackgroundSilhouette type="wallet" />
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Merhaba{displayName ? `, ${displayName}` : ''}
        </Text>
        <Text style={styles.subtitle}>Bu ayki toplam harcaman</Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalAmount}>{formatDisplayTotal()}</Text>

        {rateError && (
          <Text style={styles.rateError}>Kur bilgisi alınamadı: tekrar dene</Text>
        )}

        <View style={styles.currencyRow}>
          {(['TRY', 'USD', 'EUR'] as const).map((c) => {
            const active = viewCurrency === c;
            return (
              <Pressable
                key={c}
                onPress={() => setViewCurrency(c)}
                style={[styles.currencyBtn, active && styles.currencyBtnActive]}
              >
                <Text style={[styles.currencyText, active && styles.currencyTextActive]}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Son hareketler</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {!hasData ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Henüz harcama yok</Text>
            <Text style={styles.emptySub}>
              Sağ alttaki + butonuyla ilk harcamanı ekle.
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <TransactionList
              transactions={listItems}
              showCategory={true}
              showPayer={false}
              emptyMessage="Henüz hareket yok."
              onPress={(t) => setSelectedTx(t)}
              editable={true}
              currentUserId={user?.id}
              onEdit={(t) =>
                navigation.navigate('AddExpense', {
                  spaceId: t.space_id,
                  transactionId: t.id,
                })
              }
              onDelete={(t) => {
                // Optimistic: listeden hemen çıkar
                setRecent((prev) => prev.filter((x) => x.id !== t.id));
                setMonthly((prev) => prev.filter((x) => x.id !== t.id));
                // UndoToast göster
                setDeletedTx(t);
              }}
            />

            <Pressable
              style={styles.allTxBtn}
              onPress={() => navigation.navigate('AllTransactions')}
            >
              <Text style={styles.allTxBtnText}>Tüm Harcamalar ›</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

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

      <UndoToast
        visible={!!deletedTx}
        message="Harcama silindi"
        bottomOffset={100}
        onUndo={() => {
          if (deletedTx) {
            setRecent((prev) => [deletedTx, ...prev]);
            setMonthly((prev) => [deletedTx, ...prev]);
            setDeletedTx(null);
          }
        }}
        onExpire={async () => {
          if (deletedTx && user) {
            await deleteTransaction(user.id, deletedTx.id);
            setDeletedTx(null);
            loadData();
          }
        }}
      />

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('AddExpense', { spaceId })}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  greeting: {
    fontFamily: fonts.heading,
    fontSize: 26,
    color: colors.ink,
  },
  subtitle: { color: colors.inkSoft, marginTop: spacing.xs, fontSize: 14 },

  totalCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    fontFamily: fonts.body,
  },
  totalAmount: {
    fontFamily: fonts.heading,
    fontSize: 42,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  rateError: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.expense,
    fontFamily: fonts.body,
  },
  currencyRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  currencyBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
  },
  currencyBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  currencyTextActive: { color: colors.accentInk },

  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ink,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  emptyBox: {
    margin: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },
  emptySub: {
    color: colors.inkSoft,
    marginTop: spacing.xs,
    fontSize: 14,
    textAlign: 'center',
  },

  allTxBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  allTxBtnText: {
    color: colors.accent,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.25)',
    elevation: 6,
  },
  fabText: { color: colors.accentInk, fontSize: 32, lineHeight: 34, fontWeight: '400' },
});
