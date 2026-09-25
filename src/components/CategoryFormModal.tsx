import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../lib/auth-context';
import {
  createCategory,
  updateCategory,
} from '../lib/categoryQueries';
import type { Category } from '../types/models';
import { fonts, radius, spacing, useThemedStyles, type ThemeColors, useTheme } from '../theme';

type Props = {
  visible: boolean;
  /** Düzenleme için mevcut kategori (null ise yeni ekleme) */
  editing: Category | null;
  onClose: () => void;
  onSaved: (category: Category) => void;
};

export default function CategoryFormModal({
  visible,
  editing,
  onClose,
  onSaved,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal açıldığında doldur
  useEffect(() => {
    if (visible) {
      setName(editing?.name ?? '');
      setIcon(editing?.icon ?? '');
      setErrorMsg(null);
      setBusy(false);
    }
  }, [visible, editing]);

  const isEdit = !!editing;

  const handleSave = useCallback(async () => {
    if (!user) return;
    if (!name.trim()) {
      setErrorMsg('Lütfen kategori adı gir.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);

    const trimmedIcon = icon.trim() || null;

    const result = isEdit
      ? await updateCategory(user.id, editing!.id, name, trimmedIcon)
      : await createCategory(user.id, name, trimmedIcon);

    setBusy(false);

    if (!result.ok) {
      setErrorMsg(result.error);
      return;
    }

    onSaved(result.category);
    onClose();
  }, [user, name, icon, isEdit, editing, onSaved, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>
            {isEdit ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}
          </Text>

          {/* Emoji + İsim */}
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <TextInput
                style={styles.iconInput}
                value={icon}
                onChangeText={setIcon}
                placeholder="🙂"
                placeholderTextColor={colors.inkSoft}
                maxLength={4}
                textAlign="center"
              />
            </View>

            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Kategori adı"
              placeholderTextColor={colors.inkSoft}
              maxLength={40}
              autoFocus
            />
          </View>

          <Text style={styles.hint}>
            İkon için klavyeden bir emoji yazabilirsin.
          </Text>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.btnGhostText}>İptal</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
              onPress={handleSave}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.accentInk} />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {isEdit ? 'Güncelle' : 'Ekle'}
                </Text>
              )}
            </Pressable>
          </View>
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

  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInput: {
    fontSize: 26,
    color: colors.ink,
    width: '100%',
    height: '100%',
    textAlign: 'center',
    padding: 0,
    fontFamily: fonts.body,
  },
  nameInput: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
  },
  hint: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: spacing.sm,
    fontFamily: fonts.body,
  },

  errorBox: {
    backgroundColor: '#F8E1E1',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.expense,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: { color: colors.expense, fontSize: 12 },

  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    fontFamily: fonts.body,
  },
  btn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnGhost: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnGhostText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: colors.accentInk, fontSize: 15, fontWeight: '700' },
});
