// ============================================================
// MoneyReg — Offline durum göstergesi (üst banner)
// ============================================================

import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '../lib/networkContext';
import { fonts, spacing, useThemedStyles, type ThemeColors, useTheme } from '../theme';

export default function OfflineBanner() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { isOnline, isInitialized } = useNetworkStatus();

  if (!isInitialized || isOnline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text}>Çevrimdışın — değişiklikler bağlantı gelince senkronize edilecek</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.expense,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  icon: { fontSize: 16 },
  text: {
    color: colors.accentInk,
    fontSize: 16,
    fontFamily: fonts.body,
  },
});
