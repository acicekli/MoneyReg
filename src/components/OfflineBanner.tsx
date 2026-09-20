// ============================================================
// MoneyReg — Offline durum göstergesi (üst banner)
// ============================================================

import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '../lib/networkContext';
import { colors, fonts, spacing } from '../theme';

export default function OfflineBanner() {
  const { isOnline, isInitialized } = useNetworkStatus();

  if (!isInitialized || isOnline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text}>Çevrimdışın — değişiklikler bağlantı gelince senkronize edilecek</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.expense,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  icon: { fontSize: 14 },
  text: {
    color: colors.accentInk,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
});
