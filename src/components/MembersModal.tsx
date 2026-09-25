import { useCallback, useEffect, useState } from 'react';
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
import { useAuth } from '../lib/auth-context';
import {
  getSpaceMembers,
  removeMember,
  type SpaceMemberInfo,
} from '../lib/groupQueries';
import { fonts, radius, spacing, useThemedStyles, type ThemeColors, useTheme } from '../theme';

type Props = {
  visible: boolean;
  spaceId: string;
  spaceOwnerId: string;
  onClose: () => void;
  onMembersChanged?: () => void;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}.${m}.${y}`;
}

export default function MembersModal({
  visible,
  spaceId,
  spaceOwnerId,
  onClose,
  onMembersChanged,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<SpaceMemberInfo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isOwner = user?.id === spaceOwnerId;

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getSpaceMembers(spaceId);
    setMembers(data);
    setLoading(false);
  }, [spaceId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  // Çıkar / Ayrıl onay + işlem
  const handleRemove = useCallback(
    (target: SpaceMemberInfo, isSelf: boolean) => {
      const title = isSelf ? 'Alandan ayrıl?' : `${target.display_name} çıkarılsın mı?`;
      const body = isSelf
        ? 'Bu alandan ayrılmak istediğine emin misin?'
        : 'Bu üye alandan çıkarılacak.';

      const doRemove = async () => {
        setBusyId(target.user_id);
        const result = await removeMember(spaceId, target.user_id);
        setBusyId(null);

        if (!result.ok) {
          if (Platform.OS === 'web') window.alert('Hata: ' + result.error);
          else Alert.alert('Hata', result.error);
          return;
        }

        await load();
        onMembersChanged?.();

        if (isSelf) {
          onClose();
        }
      };

      if (Platform.OS === 'web') {
        if (window.confirm(`${title}\n\n${body}`)) doRemove();
      } else {
        Alert.alert(title, body, [
          { text: 'Vazgeç', style: 'cancel' },
          { text: isSelf ? 'Ayrıl' : 'Çıkar', style: 'destructive', onPress: doRemove },
        ]);
      }
    },
    [spaceId, load, onMembersChanged, onClose]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Üyeler</Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : members.length === 0 ? (
            <Text style={styles.emptyText}>Üye bulunamadı.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 360 }}>
              {members.map((m, idx) => {
                const isSelf = m.user_id === user?.id;
                const canRemove = isOwner && !isSelf; // kendini owner çıkaramaz
                const canLeave = isSelf && !isOwner;  // owner ayrılamaz
                const showAction = canRemove || canLeave;
                const busy = busyId === m.user_id;

                return (
                  <View
                    key={m.user_id}
                    style={[
                      styles.memberRow,
                      idx === members.length - 1 && styles.memberRowLast,
                    ]}
                  >
                    <View style={styles.memberLeft}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{m.initial}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {m.display_name}
                          {isSelf ? ' (sen)' : ''}
                          {m.user_id === spaceOwnerId ? ' · sahip' : ''}
                        </Text>
                        <Text style={styles.memberDate}>
                          Katıldı: {formatDate(m.joined_at)}
                        </Text>
                      </View>
                    </View>

                    {showAction && (
                      <Pressable
                        style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
                        onPress={() => handleRemove(m, isSelf)}
                        disabled={busy}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color={colors.expense} />
                        ) : (
                          <Text style={styles.actionBtnText}>
                            {canLeave ? 'Ayrıl' : 'Çıkar'}
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  center: { paddingVertical: spacing.xxl, alignItems: 'center' },
  emptyText: { color: colors.inkSoft, fontSize: 14, paddingVertical: spacing.lg },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    fontFamily: fonts.body,
  },
  memberRowLast: { borderBottomWidth: 0 },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    marginRight: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  memberName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
  memberDate: { color: colors.inkSoft, fontSize: 16, marginTop: 2 },

  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.expense,
    fontFamily: fonts.body,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: {
    color: colors.expense,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },

  closeBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  closeBtnText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
});
