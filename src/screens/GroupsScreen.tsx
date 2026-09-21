import { useCallback, useEffect, useState } from 'react';
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
import { onSyncComplete } from '../lib/syncEvents';
import { useOnlineGuard } from '../lib/onlineGuard';
import { getSharedSpacesWithMeta, type SpaceWithMeta } from '../lib/groupQueries';
import { getSpaceDetail } from '../lib/groupDetailQueries';
import SpaceCard from '../components/SpaceCard';
import JoinByCodeModal from '../components/JoinByCodeModal';
import BackgroundSilhouette from '../components/BackgroundSilhouette';
import { colors, fonts, radius, spacing } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'Groups'>;

export default function GroupsScreen() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { guard } = useOnlineGuard();
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<SpaceWithMeta[]>([]);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;

    // 1) Cache'ten oku
    const cached = await getCached<SpaceWithMeta[]>(CacheKeys.groupsList);
    if (cached) {
      setSpaces(cached);
      setLoading(false);
    }

    // 2) Offline ise cache ile kal
    if (!isOnline) {
      setLoading(false);
      return;
    }

    // 3) Online → çek
    if (!cached) setLoading(true);
    try {
      const data = await getSharedSpacesWithMeta(user.id);
      setSpaces(data);
      await setCached(CacheKeys.groupsList, data);

      // 4) ARKA PLAN PRELOAD: her grubun detayını cache'le
      // (await YOK — kullanıcı beklemez)
      data.forEach((s) => {
        getSpaceDetail(s.id)
          .then((detail) => {
            if (detail) {
              setCached(CacheKeys.groupDetail(s.id), detail);
            }
          })
          .catch(() => {
            // sessizce yut
          });
      });
    } finally {
      setLoading(false);
    }
  }, [user, isOnline]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Sync tamamlanınca verileri yenile
  useEffect(() => {
    const unsubscribe = onSyncComplete(() => load());
    return unsubscribe;
  }, [load]);

  const active = spaces.filter((s) => s.status === 'active');
  const closed = spaces.filter((s) => s.status === 'closed');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <BackgroundSilhouette type="house" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.btnRow}>
          <Pressable
            style={[
              styles.btn,
              styles.btnPrimary,
              !isOnline && styles.btnDisabled,
            ]}
            onPress={() => guard(() => navigation.navigate('CreateSpace'), 'Yeni alan oluşturma')}
          >
            <Text style={styles.btnPrimaryText}>＋ Yeni alan</Text>
          </Pressable>

          <Pressable
            style={[
              styles.btn,
              styles.btnGhost,
              !isOnline && styles.btnDisabled,
            ]}
            onPress={() => guard(() => setJoinModalOpen(true), 'Kod ile katılma')}
          >
            <Text style={styles.btnGhostText}>Kod ile Katıl</Text>
          </Pressable>
        </View>

        {spaces.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Henüz paylaşımlı alan yok</Text>
            <Text style={styles.emptySub}>
              Yeni bir alan oluştur ya da bir davet koduyla katıl.
            </Text>
          </View>
        )}

        {active.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Aktif alanlar</Text>
            {active.map((s) => (
              <SpaceCard
                key={s.id}
                space={s}
                onPress={() => navigation.navigate('GroupDetail', { spaceId: s.id })}
              />
            ))}
          </>
        )}

        {closed.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
              Sonlandırılmış alanlar
            </Text>
            {closed.map((s) => (
              <SpaceCard
                key={s.id}
                space={s}
                onPress={() => navigation.navigate('GroupDetail', { spaceId: s.id })}
              />
            ))}
          </>
        )}
      </ScrollView>

      <JoinByCodeModal
        visible={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onJoined={load}
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
  scroll: { padding: spacing.lg },

  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  btn: {
    flex: 1, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line,
    fontFamily: fonts.body,
  },
  btnGhostText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },

  sectionTitle: {
    fontFamily: fonts.heading, fontSize: 16, color: colors.ink,
    marginBottom: spacing.sm,
  },

  emptyBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.xl, alignItems: 'center',
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },
  emptySub: {
    color: colors.inkSoft, marginTop: spacing.xs,
    fontSize: 14, textAlign: 'center',
  },
});
