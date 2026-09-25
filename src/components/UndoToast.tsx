import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, radius, spacing, useThemedStyles, type ThemeColors, useTheme } from '../theme';

type Props = {
  visible: boolean;
  message?: string;
  onUndo: () => void;
  onExpire: () => void;
  duration?: number; // ms, default 2000
  bottomOffset?: number; // px, default 16
};

export default function UndoToast({
  visible,
  message = 'Harcama silindi',
  onUndo,
  onExpire,
  duration = 2000,
  bottomOffset = 16,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => onExpire(), duration);
    return () => clearTimeout(t);
  }, [visible, duration, onExpire]);

  if (!visible) return null;

  return (
    <View style={[styles.toast, { bottom: bottomOffset }]}>
      <Text style={styles.text} numberOfLines={1}>{message}</Text>
      <Pressable onPress={onUndo} style={styles.btn}>
        <Text style={styles.btnText}>Geri Al</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    elevation: 8,
  },
  text: { color: colors.surface, fontSize: 13, flex: 1 },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    fontFamily: fonts.body,
  },
  btnText: { color: colors.accentInk, fontSize: 13, fontWeight: '700' },
});
