// ============================================================
// MoneyReg — Geri Bildirim Modalı
// ============================================================

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useTheme,
  useThemedStyles,
  fonts,
  radius,
  spacing,
  type ThemeColors,
} from '../theme';
import type { FeedbackCategory } from '../lib/feedbackQueries';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    category: FeedbackCategory,
    message: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  saving: boolean;
};

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: '🐞 Hata' },
  { value: 'feature', label: '💡 Öneri' },
  { value: 'other', label: '💬 Diğer' },
];

const MESSAGE_MAX = 500;

export default function FeedbackModal({
  visible,
  onClose,
  onSubmit,
  saving,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');

  // Modal her açıldığında sıfırla
  useEffect(() => {
    if (visible) {
      setCategory('bug');
      setMessage('');
    }
  }, [visible]);

  const canSubmit = message.trim().length >= 3 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit(category, message.trim());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Geri Bildirim</Text>
            <Text style={styles.subtitle}>
              Düşüncelerini paylaş, uygulamayı birlikte geliştirelim.
            </Text>

            {/* Kategori */}
            <Text style={styles.label}>Kategori</Text>
            <View style={styles.pillRow}>
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        active && styles.pillTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Mesaj */}
            <Text style={[styles.label, { marginTop: spacing.md }]}>
              Mesaj
            </Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={(t) => setMessage(t.slice(0, MESSAGE_MAX))}
              placeholder="Hata, öneri veya düşüncelerini yaz..."
              placeholderTextColor={colors.inkSoft}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={MESSAGE_MAX}
            />
            <Text style={styles.charCount}>
              {message.length} / {MESSAGE_MAX}
            </Text>

            {/* Butonlar */}
            <View style={styles.btnRow}>
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={[styles.btn, styles.btnGhost]}
              >
                <Text style={styles.btnGhostText}>İptal</Text>
              </Pressable>

              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={[
                  styles.btn,
                  styles.btnPrimary,
                  !canSubmit && styles.btnDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.accentInk} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Gönder</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    sheet: {
      width: '100%',
      maxWidth: 460,
      maxHeight: '90%',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.lg,
    },

    title: {
      fontFamily: fonts.heading,
      fontSize: 22,
      color: colors.ink,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
      marginBottom: spacing.lg,
    },

    label: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Kategori pill'leri
    pillRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    pill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: colors.ink,
      backgroundColor: colors.surface,
    },
    pillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.ink,
    },
    pillText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
    pillTextActive: { color: colors.accentInk },

    // Mesaj input'u
    messageInput: {
      minHeight: 120,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.ink,
      backgroundColor: colors.surface,
      color: colors.ink,
      fontFamily: fonts.body,
      fontSize: 15,
      textAlignVertical: 'top',
    },
    charCount: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.inkSoft,
      textAlign: 'right',
      marginTop: spacing.xs,
    },

    // Butonlar
    btnRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    btn: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    btnGhost: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.ink,
    },
    btnGhostText: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: colors.ink,
    },
    btnPrimary: {
      backgroundColor: colors.accent,
    },
    btnPrimaryText: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: colors.accentInk,
    },
    btnDisabled: {
      opacity: 0.4,
    },
  });
