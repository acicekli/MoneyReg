import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../lib/format';
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
  getPersonalSpaceId,
  getProfileDisplayName,
  getRecentTransactions,
  mapCategoriesById,
} from '../lib/homeQueries';
import { deleteTransaction } from '../lib/transactionQueries';
import { deleteInstallmentGroup } from '../services/transactionService';
import { enqueue } from '../lib/offlineQueue';
import {
  transactionAmountInTRY,
  type Category,
  type Transaction,
} from '../types/models';
import BackgroundSilhouette from '../components/BackgroundSilhouette';
import { fonts, radius, spacing, useTheme } from '../theme';
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
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  
  // Sunucudan/Cache'ten gelen harcamalar
  const [recent, setRecent] = useState<Transaction[]>([]);
  // Kuyrukta bekleyen (offline eklenen) harcamalar
  const [pendingTxs, setPendingTxs] = useState<Transaction[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [viewCurrency, setViewCurrency] = useState<ViewCurrency>('TRY');
  const [usdRate, setUsdRate] = useState<number | null>(null);
  const [eurRate, setEurRate] = useState<number | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [deletedTxs, setDeletedTxs] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<TransactionListItem | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;

    // 1) Cache'ten oku — varsa hemen göster
    const [cachedRecent, cachedName, cachedSpaceId, cachedCats] =
      await Promise.all([
        getCached<Transaction[]>(CacheKeys.homeTransactions),
        getCached<string>(CacheKeys.homeDisplayName),
        getCached<string>(CacheKeys.homeSpaceId),
        getCached<Category[]>(CacheKeys.categories),
      ]);

    if (cachedName) setDisplayName(cachedName);
    if (cachedSpaceId) setSpaceId(cachedSpaceId);
    if (cachedCats) setCategories(cachedCats);
    if (cachedRecent) setRecent(cachedRecent);

    const hasCache = cachedRecent !== null || cachedCats !== null;
    if (hasCache) setLoading(false);

    // 2) Kuyruktaki bekleyenleri HER ZAMAN oku (offline veya online farketmez)
    const queue = await getQueue();
    const pendingCreates: Transaction[] = [];

    for (const q of queue) {
      if (q.type === 'create_transaction') {
        const p = q.payload;
        pendingCreates.push({
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
          installment_group_id: null,
          installment_number: null,
          total_installments: null,
        } as Transaction);
      } else if (q.type === 'create_installment_group') {
        const rows = q.payload.rows ?? [];
        for (const r of rows) {
          pendingCreates.push({
            id: `pending-${q.id}-${r.installment_number}`,
            space_id: r.space_id,
            created_by: user.id,
            amount: r.amount,
            currency: r.currency,
            exchange_rate_snapshot: r.exchange_rate_snapshot ?? null,
            category_id: r.category_id,
            note: r.note ?? null,
            expense_date: r.expense_date,
            receipt_photo_url: r.receipt_photo_url ?? null,
            created_at: new Date(q.createdAt).toISOString(),
            updated_at: new Date(q.createdAt).toISOString(),
            installment_group_id: r.installment_group_id || q.id,
            installment_number: r.installment_number,
            total_installments: r.total_installments,
          } as Transaction);
        }
      }
    }
    setPendingTxs(pendingCreates);

    // 3) Offline ise burada dur, sunucuya gitme
    if (!isOnline) {
      setLoading(false);
      return;
    }

    // 4) Online → Supabase'den çek, cache'i güncelle
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
        setCached(CacheKeys.homeSpaceId, sid),
        setCached(CacheKeys.categories, cats),
      ]);

      if (sid) {
        const recentData = await getRecentTransactions(sid, 12);
        setRecent(recentData);
        await setCached(CacheKeys.homeTransactions, recentData);
      } else {
        setRecent([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, isOnline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Gece 00:00'da veriyi yenile (yeni taksitlerin düşmesi için)
  useEffect(() => {
    const checkMidnight = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        loadData();
      }
    }, 60000);

    return () => clearInterval(checkMidnight);
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

  const categoryMap = useMemo(() => mapCategoriesById(categories), [categories]);

  // ANA LİSTE MANTIĞI: recent + pendingTxs birleştir, tekleştir, tarihe göre sırala
  const listItems: TransactionListItem[] = useMemo(() => {
    const combined = [...pendingTxs, ...recent];
    
    const seenIds = new Set<string>();
    const unique = combined.filter((t) => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });

    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    
    // Gelecek tarihli olanları listeden çıkar
    const pastTxs = unique.filter((t) => t.expense_date <= todayStr);
    
    // En eski tarihten en yeniye doğru sırala (Böylece tekleştirmede taksitin 1.'si kalır)
    pastTxs.sort((a, b) => a.expense_date.localeCompare(b.expense_date));

    const seenGroups = new Set<string>();
    const filteredRecent: Transaction[] = [];
    
    for (const t of pastTxs) {
      if (t.installment_group_id) {
        if (seenGroups.has(t.installment_group_id)) continue;
        seenGroups.add(t.installment_group_id);
      }
      filteredRecent.push(t);
    }
    
    // Tekilleştirmeden sonra listeyi tekrar tarihe göre yeniden eskiye sırala
    filteredRecent.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
    
    // Son 12 kaydı al
    const finalRecent = filteredRecent.slice(0, 12);

    return finalRecent.map((t) => {
      const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
      return {
        ...t,
        category_name: cat?.name ?? (t.category_id ? null : 'Kategorisiz'),
        category_icon: cat?.icon ?? (t.category_id ? null : '📦'),
      };
    });
  }, [recent, pendingTxs, categoryMap]);

  const totalTRY = useMemo(() => {
    let sum = 0;
    for (const t of listItems) sum += transactionAmountInTRY(t);
    return sum;
  }, [listItems]);

  const pendingRateCount = useMemo(() => {
    return listItems.filter(
      (t) => t.currency !== 'TRY' && t.exchange_rate_snapshot == null
    ).length;
  }, [listItems]);

  const displayTotal = useMemo<{ value: number; symbol: string }>(() => {
    if (viewCurrency === 'TRY') return { value: totalTRY, symbol: '₺' };
    if (viewCurrency === 'USD') {
      if (usdRate == null) return { value: 0, symbol: '$' };
      return { value: totalTRY / usdRate, symbol: '$' };
    }
    if (eurRate == null) return { value: 0, symbol: '€' };
    return { value: totalTRY / eurRate, symbol: '€' };
  }, [viewCurrency, totalTRY, usdRate, eurRate]);

  function formatDisplayTotal(): string {
    return formatCurrency(displayTotal.value, viewCurrency as 'TRY' | 'USD' | 'EUR');
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        center: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
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
        pendingRateNote: {
          marginTop: spacing.xs,
          fontSize: 12,
          color: colors.inkSoft,
          fontFamily: fonts.body,
          textAlign: 'center',
        },
        currencyRow: {
          flexDirection: 'row',
          alignSelf: 'center',
          marginTop: spacing.md,
          gap: spacing.xs,
          padding: 4,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 100,
        },
        currencyBtn: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: 100,
        },
        currencyText: { color: colors.ink, fontSize: 13, fontWeight: '600', fontFamily: fonts.body },
        currencyBtnActive: { backgroundColor: colors.ink },
        currencyTextActive: { color: colors.bg },
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
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 6px rgba(0,0,0,0.25)',
          elevation: 6,
        },
        fabText: { color: colors.accentInk, fontSize: 26, lineHeight: 28, fontWeight: '400' },
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

  if (!spaceId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Kişisel alan bulunamadı</Text>
        <Text style={styles.emptySub}>Lütfen tekrar giriş yap.</Text>
      </View>
    );
  }

  const hasData = listItems.length > 0;

  return (
    <View style={styles.container}>
      <BackgroundSilhouette type="wallet" />
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Merhaba{displayName ? `, ${displayName}` : ''}
        </Text>
        <Text style={styles.subtitle}>Son 12 harcamanın toplamı</Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalAmount}>{formatDisplayTotal()}</Text>

        {rateError && (
          <Text style={styles.rateError}>Kur bilgisi alınamadı: tekrar dene</Text>
        )}

        {pendingRateCount > 0 && (
          <Text style={styles.pendingRateNote}>
            ⏳ {pendingRateCount} harcamanın kur bilgisi bekleniyor
            {viewCurrency !== 'TRY' ? ' (toplama dahil değil)' : ''}
          </Text>
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
              variant="card"
              emptyMessage="Henüz hareket yok."
              onPress={(t) => setSelectedTx(t)}
              editable={true}
              currentUserId={user?.id}
              onEdit={(t) =>
                navigation.navigate('AddExpense', {
                  spaceId: t.space_id,
                  transactionId: t.id,
                  installmentGroupId: t.installment_group_id || undefined,
                })
              }
              onDelete={async (t) => {
                if (t.installment_group_id) {
                  setRecent((prev) => {
                    const updated = prev.filter(
                      (x) => x.installment_group_id !== t.installment_group_id
                    );
                    if (!isOnline) {
                      setCached(CacheKeys.homeTransactions, updated);
                    }
                    return updated;
                  });

                  if (isOnline) {
                    await deleteInstallmentGroup(t.installment_group_id);
                    loadData();
                  } else {
                    await enqueue('delete_installment_group', { groupId: t.installment_group_id });
                  }
                } else {
                  setRecent((prev) => prev.filter((x) => x.id !== t.id));
                  setDeletedTxs((prev) => [...prev, t]);
                }
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

      <UndoToast
        visible={deletedTxs.length > 0}
        message={
          deletedTxs.length > 1
            ? `${deletedTxs.length} harcama silindi`
            : 'Harcama silindi'
        }
        bottomOffset={100}
        onUndo={() => {
          const last = deletedTxs[deletedTxs.length - 1];
          if (last) {
            setRecent((prev) => [last, ...prev]);
            setDeletedTxs((prev) => prev.slice(0, -1));
          }
        }}
        onExpire={async () => {
          if (deletedTxs.length === 0 || !user) return;
          try {
            for (const tx of deletedTxs) {
              if (isOnline) {
                const r = await deleteTransaction(user.id, tx.id);
                if (!r.ok && !r.code) {
                  await enqueue('delete_transaction', { transactionId: tx.id });
                }
              } else {
                await enqueue('delete_transaction', {
                  transactionId: tx.id,
                });
              }
            }
          } finally {
            setDeletedTxs([]);
            if (isOnline) {
              loadData();
            } else {
              setRecent((prev) => {
                const updated = prev.filter(
                  (t) => !deletedTxs.some((d) => d.id === t.id)
                );
                setCached(CacheKeys.homeTransactions, updated);
                return updated;
              });
            }
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
