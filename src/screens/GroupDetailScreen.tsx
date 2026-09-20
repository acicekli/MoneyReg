import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatExpenseAmount, formatAmount as fmtAmount, formatPercent } from '../lib/format';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { useNetworkStatus } from '../lib/networkContext';
import { getCached, setCached, CacheKeys } from '../lib/localCache';
import { onSyncComplete } from '../lib/syncEvents';
import { useOnlineGuard } from '../lib/onlineGuard';
import {
  closeSpace,
  getSpaceDetail,
  type SpaceDetail,
} from '../lib/groupDetailQueries';
import { supabase } from '../lib/supabase';
import { deleteTransaction } from '../lib/transactionQueries';
import { type Category } from '../types/models';
import BackgroundSilhouette from '../components/BackgroundSilhouette';
import { colors, fonts, radius, spacing } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';
import TransactionList, {
  type TransactionListItem,
} from '../components/TransactionList';
import InviteModal from '../components/InviteModal';
import MembersModal from '../components/MembersModal';
import UndoToast from '../components/UndoToast';
import TransactionDetailModal from '../components/TransactionDetailModal';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupDetail'>;
type RouteT = RouteProp<GroupsStackParamList, 'GroupDetail'>;


export default function GroupDetailScreen() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { guard } = useOnlineGuard();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { spaceId } = route.params;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SpaceDetail | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deletedTx, setDeletedTx] = useState<Transaction | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionListItem | null>(null);

  const load = useCallback(async () => {
    // 1) Cache'ten oku
    const cachedDetail = await getCached<SpaceDetail>(CacheKeys.groupDetail(spaceId));
    const cachedCats = await getCached<Category[]>(CacheKeys.categories);

    if (cachedDetail) {
      setDetail(cachedDetail);
      setLoading(false);
    }
    if (cachedCats) setCategories(cachedCats);

    // 2) Offline ise cache ile kal
    if (!isOnline) {
      // Cache'te detay YOKSA → GroupsScreen cache'inden temel bilgi al
      // Cache'te detay VARSA → yukarıda zaten set edildi, dokunma
      if (!cachedDetail) {
        const cachedGroups = await getCached<any[]>(CacheKeys.groupsList);
        const summary = cachedGroups?.find((g) => g.id === spaceId);
        if (summary) {
          setDetail({
            space: {
              id: summary.id,
              type: summary.type,
              name: summary.name,
              status: summary.status,
              created_by: summary.created_by,
              invite_code: summary.invite_code ?? '',
              created_at: summary.created_at,
            },
            members: [],
            transactions: [],
            totalTRY: summary.totalTRY ?? 0,
            balances: [],
          });
        }
      }
      setLoading(false);
      return;
    }

    // 3) Online → çek
    if (!cachedDetail) setLoading(true);
    const [d, catRes] = await Promise.all([
      getSpaceDetail(spaceId),
      supabase.from('categories').select('*'),
    ]);
    setDetail(d);
    const cats = (catRes.data ?? []) as Category[];
    setCategories(cats);
    setLoading(false);

    if (d) await setCached(CacheKeys.groupDetail(spaceId), d);
    await setCached(CacheKeys.categories, cats);
  }, [spaceId, isOnline]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Sync tamamlanınca verileri yenile
  useEffect(() => {
    const unsubscribe = onSyncComplete(() => load());
    return unsubscribe;
  }, [load]);

  useEffect(() => {
    if (detail?.space.status === 'closed') {
      navigation.replace('ClosingReport', { spaceId });
    }
  }, [detail?.space.status, navigation, spaceId]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const listItems: TransactionListItem[] = useMemo(() => {
    if (!detail) return [];
    return detail.transactions.map((t) => {
      const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
      return {
        ...t,
        payer_display_name: t.payer_display_name,
        category_name: cat?.name ?? (t.category_id ? null : 'Kategorisiz'),
        category_icon: cat?.icon ?? (t.category_id ? null : '📦'),
      };
    });
  }, [detail, categoryMap]);

  async function handleClose() {
    setMenuOpen(false);
    if (!isOnline) {
      guard(() => {}, 'Alanı sonlandırma');
      return;
    }

    const doClose = async () => {
      const result = await closeSpace(spaceId);
      if (!result.ok) {
        if (Platform.OS === 'web') window.alert('Hata: ' + result.error);
        else Alert.alert('Hata', result.error);
        return;
      }
      navigation.replace('ClosingReport', { spaceId });
    };

    if (Platform.OS === 'web') {
      const ok = window.confirm('Proje sonlandırılsın mı?');
      if (ok) await doClose();
    } else {
      Alert.alert(
        'Proje sonlandırılsın mı?',
        'Bu işlem geri alınamaz. Yeni harcama eklenemez.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Sonlandır', style: 'destructive', onPress: doClose },
        ]
      );
    }
  }

  function handleCalculate() {
    setMenuOpen(false);
    guard(
      () => navigation.navigate('CalculateModal', { spaceId }),
      'Hesaplama'
    );
  }

  function handleInvite() {
    setMenuOpen(false);
    setInviteOpen(true);
  }

  function handleMembers() {
    setMenuOpen(false);
    setMembersOpen(true);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Alan bulunamadı</Text>
      </View>
    );
  }

  const { space, members, totalTRY } = detail;
  const isOwner = user?.id === space.created_by;

  return (
    <View style={styles.root}>
      <BackgroundSilhouette type="people" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.spaceName} numberOfLines={1}>{space.name}</Text>

            <Pressable style={styles.avatarRow} onPress={handleMembers}>
              {members.slice(0, 4).map((m, idx) => (
                <View
                  key={m.user_id}
                  style={[styles.avatar, { marginLeft: idx === 0 ? 0 : -8 }]}
                >
                  <Text style={styles.avatarText}>{m.initial}</Text>
                </View>
              ))}
              {members.length > 4 && (
                <View style={[styles.avatar, styles.avatarExtra, { marginLeft: -8 }]}>
                  <Text style={styles.avatarText}>+{members.length - 4}</Text>
                </View>
              )}
              <Text style={styles.membersLink}>
                {members.length} üye · gör
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.menuBtn}
            onPress={() => setMenuOpen(true)}
            hitSlop={12}
          >
            <Text style={styles.menuBtnText}>⋯</Text>
          </Pressable>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Toplam</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalTRY)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Harcamalar</Text>
        <TransactionList
          transactions={listItems}
          showPayer={true}
          showCategory={true}
          emptyMessage="Henüz harcama yok."
          onPress={(t) => setSelectedTx(t)}
          editable={true}
          currentUserId={user?.id}
          onEdit={(t) =>
            navigation.navigate('AddExpense' as never, {
              spaceId: t.space_id,
              transactionId: t.id,
            } as never)
          }
          onDelete={(t) => {
            if (!detail) return;
            // Optimistic
            setDetail({
              ...detail,
              transactions: detail.transactions.filter((x) => x.id !== t.id),
            });
            setDeletedTx(t);
          }}
        />
      </ScrollView>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <Pressable
              style={[styles.menuItem, !isOnline && styles.menuItemDisabled]}
              onPress={handleCalculate}
            >
              <Text style={[styles.menuItemText, !isOnline && styles.menuItemTextDisabled]}>
                Hesapla
              </Text>
            </Pressable>

            <Pressable style={styles.menuItem} onPress={handleMembers}>
              <Text style={styles.menuItemText}>Üyeler</Text>
            </Pressable>

            <Pressable style={styles.menuItem} onPress={handleInvite}>
              <Text style={styles.menuItemText}>Üye Davet Et</Text>
            </Pressable>

            {isOwner && (
              <Pressable
                style={[
                  styles.menuItem,
                  styles.menuItemLast,
                  !isOnline && styles.menuItemDisabled,
                ]}
                onPress={handleClose}
              >
                <Text
                  style={[
                    styles.menuItemText,
                    styles.menuItemDangerText,
                    !isOnline && styles.menuItemTextDisabled,
                  ]}
                >
                  Sonlandır
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      <InviteModal
        visible={inviteOpen}
        spaceName={space.name}
        inviteCode={space.invite_code}
        onClose={() => setInviteOpen(false)}
      />

      <MembersModal
        visible={membersOpen}
        spaceId={spaceId}
        spaceOwnerId={space.created_by}
        onClose={() => setMembersOpen(false)}
        onMembersChanged={load}
      />

      <TransactionDetailModal
        visible={!!selectedTx}
        transaction={selectedTx}
        spaceName={detail?.space.name}
        onClose={() => setSelectedTx(null)}
        onEdit={
          selectedTx?.created_by === user?.id
            ? () => {
                const tx = selectedTx;
                setSelectedTx(null);
                navigation.navigate('AddExpense' as never, {
                  spaceId: tx.space_id,
                  transactionId: tx.id,
                } as never);
              }
            : undefined
        }

      />

      <UndoToast
        visible={!!deletedTx}
        message="Harcama silindi"
        onUndo={() => {
          if (deletedTx) {
            // Listeye geri ekle
            setDetail((prev) =>
              prev
                ? {
                    ...prev,
                    transactions: [deletedTx as any, ...prev.transactions],
                  }
                : prev
            );
            setDeletedTx(null);
          }
        }}
        onExpire={async () => {
          if (deletedTx && user) {
            await deleteTransaction(user.id, deletedTx.id);
            setDeletedTx(null);
            load();
          }
        }}
      />

      <TransactionDetailModal
        visible={!!selectedTx}
        transaction={selectedTx}
        spaceName={detail?.space.name}
        onClose={() => setSelectedTx(null)}
        onEdit={
          selectedTx?.created_by === user?.id
            ? () => {
                const tx = selectedTx;
                setSelectedTx(null);
                navigation.navigate('AddExpense' as never, {
                  spaceId: tx.space_id,
                  transactionId: tx.id,
                } as never);
              }
            : undefined
        }

      />

      <UndoToast
        visible={!!deletedTx}
        message="Harcama silindi"
        onUndo={() => {
          if (deletedTx) {
            // Listeye geri ekle
            setDetail((prev) =>
              prev
                ? {
                    ...prev,
                    transactions: [deletedTx as any, ...prev.transactions],
                  }
                : prev
            );
            setDeletedTx(null);
          }
        }}
        onExpire={async () => {
          if (deletedTx && user) {
            await deleteTransaction(user.id, deletedTx.id);
            setDeletedTx(null);
            load();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: spacing.md,
  },
  headerLeft: { flex: 1 },
  spaceName: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  avatarRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.sm, gap: spacing.xs,
  },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.accent,
    borderWidth: 2, borderColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarExtra: { backgroundColor: colors.inkSoft },
  avatarText: { color: colors.accentInk, fontWeight: '700', fontSize: 12 },
  membersLink: {
    color: colors.accent, fontSize: 12,
    fontWeight: '600', marginLeft: spacing.xs,
  },

  menuBtn: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
  menuBtnText: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink },

  totalBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.lg, alignItems: 'center', marginBottom: spacing.lg,
  },
  totalLabel: { color: colors.inkSoft, fontSize: 13 },
  totalValue: {
    fontFamily: fonts.heading, fontSize: 32,
    color: colors.ink, marginTop: spacing.xs,
  },

  sectionTitle: {
    fontFamily: fonts.heading, fontSize: 16, color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: 80, paddingRight: spacing.lg,
  },
  menuSheet: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    minWidth: 180, overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  menuItemDangerText: { color: colors.expense },
  menuItemDisabled: { opacity: 0.4 },
  menuItemTextDisabled: { color: colors.inkSoft },
});
