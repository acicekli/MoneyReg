import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../lib/auth-context';
import { updateMonthStartDay } from '../lib/reportsQueries';
import NumberSlider from './NumberSlider';
import { fonts, radius, spacing, useThemedStyles, type ThemeColors, useTheme } from '../theme';

type Props = {
  visible: boolean;
  currentDay: number;
  onClose: () => void;
  onSaved: (newDay: number) => void;
};

export default function MonthStartDayModal({
  visible,
  currentDay,
  onClose,
  onSaved,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();

  const [day, setDay] = useState(currentDay);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal açıldığında değeri sıfırla
  useEffect(() => {
    if (visible) {
      setDay(currentDay);
      setErrorMsg(null);
      setSaving(false);
    }
  }, [visible, currentDay]);

  const changed = day !== currentDay;

  const handleSave = useCallback(async () => {
    if (!user) return;
    if (!changed) {
      onClose();
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    const result = await updateMonthStartDay(user.id, day);
    setSaving(false);

    if (!result.ok) {
      setErrorMsg(result.error);
      return;
    }

    onSaved(day);
    onClose();
  }, [user, day, changed, onSaved, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Ay başı günü</Text>
          <Text style={styles.subtitle}>
            Aylık raporun hangi günden başlayacağını seç.
          </Text>

          <View style={styles.sliderWrap}>
            <NumberSlider min={1} max={31} value={day} onChange={setDay} />
          </View>

          <Text style={styles.rangeHint}>
            1 ile 31 arası. 29-31 seçersen, kısa aylarda ayın son günü
            kullanılır.
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
              disabled={saving}
            >
              <Text style={styles.btnGhostText}>İptal</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.accentInk} />
              ) : (
                <Text style={styles.btnPrimaryText}>Kaydet</Text>
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
    fontSize: 18,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    marginBottom: spacing.md,
    fontFamily: fonts.body,
  },
  sliderWrap: {
    marginVertical: spacing.md,
  },
  rangeHint: {
    color: colors.inkSoft,
    fontSize: 12,
    marginBottom: spacing.md,
    lineHeight: 16,
    fontFamily: fonts.body,
  },
  errorBox: {
    backgroundColor: '#F8E1E1',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.expense,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.expense, fontSize: 12 },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
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
  btnGhostText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnPrimaryText: {
    color: colors.accentInk,
    fontSize: 16,
    fontFamily: fonts.body,
  },
});
