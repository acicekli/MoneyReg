import { useCallback } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

type Props = {
  visible: boolean;
  spaceName: string;
  inviteCode: string;
  onClose: () => void;
};

export default function InviteModal({
  visible,
  spaceName,
  inviteCode,
  onClose,
}: Props) {
  const handleShare = useCallback(async () => {
    const message = `${spaceName} alanına katılmak için bu kodu kullan: ${inviteCode}`;

    try {
      if (Platform.OS === 'web') {
        // Web'de Share API desteklenmeyebilir → clipboard fallback
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          window.alert('Kod panoya kopyalandı:\n\n' + message);
        } else {
          window.alert(message);
        }
        return;
      }

      await Share.share({ message });
    } catch {
      // sessizce yut
    }
  }, [spaceName, inviteCode]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Üye Davet Et</Text>
          <Text style={styles.subtitle}>
            Bu kodu paylaşarak başkalarını "{spaceName}" alanına davet
            edebilirsin.
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{inviteCode}</Text>
          </View>

          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>Kodu Paylaş</Text>
          </Pressable>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  codeBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.accent,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  codeText: {
    fontFamily: fonts.heading,
    fontSize: 42,
    color: colors.accent,
    letterSpacing: 4,
  },
  shareBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  shareBtnText: {
    color: colors.accentInk,
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  closeBtnText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '600',
  },
});
