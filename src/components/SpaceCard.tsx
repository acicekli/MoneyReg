import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCurrency, formatExpenseAmount, formatAmount as fmtAmount, formatPercent } from '../lib/format';
import { colors, fonts, radius, spacing } from '../theme';
import type { SpaceWithMeta } from '../lib/groupQueries';

type Props = {
  space: SpaceWithMeta;
  onPress: () => void;
};

const MAX_AVATARS = 4;


export default function SpaceCard({ space, onPress }: Props) {
  const isClosed = space.status === 'closed';

  const initials = space.memberInitials ?? [];
  const visible = initials.slice(0, MAX_AVATARS);
  const extra = Math.max(0, initials.length - MAX_AVATARS);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isClosed && styles.cardClosed,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {space.name}
        </Text>
        {isClosed && <Text style={styles.closedBadge}>sonlandırıldı</Text>}
      </View>

      <View style={styles.avatarRow}>
        {visible.map((init, idx) => (
          <View
            key={idx}
            style={[styles.avatar, { marginLeft: idx === 0 ? 0 : -8 }]}
          >
            <Text style={styles.avatarText}>{init}</Text>
          </View>
        ))}
        {extra > 0 && (
          <View style={[styles.avatar, styles.avatarExtra, { marginLeft: -8 }]}>
            <Text style={styles.avatarText}>+{extra}</Text>
          </View>
        )}
        {initials.length === 0 && (
          <Text style={styles.noMembers}>üye yok</Text>
        )}
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.totalLabel}>Toplam</Text>
        <Text style={styles.totalValue}>{formatCurrency(space.totalTRY)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardPressed: { backgroundColor: colors.surfaceAlt },
  cardClosed: { opacity: 0.65 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.ink,
    flex: 1,
    marginRight: spacing.sm,
  },
  closedBadge: {
    fontSize: 11,
    color: colors.inkSoft,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 32,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accent,
    borderWidth: 2, borderColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarExtra: { backgroundColor: colors.inkSoft },
  avatarText: { color: colors.accentInk, fontSize: 13, fontWeight: '700' },
  noMembers: { color: colors.inkSoft, fontSize: 13, fontStyle: 'italic' },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
  },
  totalLabel: { color: colors.inkSoft, fontSize: 13 },
  totalValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
});
