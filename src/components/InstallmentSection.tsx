// ============================================================
// MoneyReg — Taksit Seçim Bölümü
// AddExpenseScreen içinde kullanılır.
// ============================================================

import { useEffect, useState } from 'react';
import {
  Pressable,
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

export type AmountMode = 'total' | 'perMonth';

export interface InstallmentSectionProps {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  amount: number;
  amountMode: AmountMode;
  onAmountModeChange: (mode: AmountMode) => void;
  currencySymbol?: string;
  installmentCount: number;
  onInstallmentCountChange: (count: number) => void;
  startNextMonth: boolean;
  onStartNextMonthChange: (startNextMonth: boolean) => void;
}

const COUNT_MIN = 2;
const COUNT_MAX = 36;

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function addMonthsToNow(months: number): { year: number; monthIndex: number } {
  const now = new Date();
  const targetMonth = now.getMonth() + months;
  const targetYear = now.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  return { year: targetYear, monthIndex: normalizedMonth };
}

function formatMonthTR(year: number, monthIndex: number): string {
  return `${MONTH_NAMES_TR[monthIndex]} ${year}`;
}

export default function InstallmentSection({
  enabled,
  onToggleEnabled,
  amount,
  amountMode,
  onAmountModeChange,
  currencySymbol = '₺',
  installmentCount,
  onInstallmentCountChange,
  startNextMonth,
  onStartNextMonthChange,
}: InstallmentSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  // Input metni — state ile senkronize
  const [countText, setCountText] = useState(String(installmentCount));

  useEffect(() => {
    // Parent değişirse input'u güncelle
    setCountText(String(installmentCount));
  }, [installmentCount]);

  // amountMode'a göre toplam ve aylık
  const safeCount = installmentCount > 0 ? installmentCount : 1;
  const totalAmount = amountMode === 'total'
    ? amount
    : Math.round(amount * safeCount * 100) / 100;
  const perMonth = amountMode === 'total'
    ? Math.round((amount / safeCount) * 100) / 100
    : amount;
  const perMonthLabel = `${currencySymbol}${perMonth.toFixed(2)}`;
  const totalLabel = `${currencySymbol}${totalAmount.toFixed(2)}`;

  // Not: tarih aralığı ve küsürat uyarısı UI'dan kaldırıldı

  const handleCountChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    setCountText(digits);
    const n = parseInt(digits, 10);
    if (!isNaN(n) && n >= COUNT_MIN && n <= COUNT_MAX) {
      onInstallmentCountChange(n);
    }
  };

  const handleCountBlur = () => {
    const n = parseInt(countText, 10);
    if (isNaN(n) || n < COUNT_MIN) {
      setCountText(String(COUNT_MIN));
      onInstallmentCountChange(COUNT_MIN);
    } else if (n > COUNT_MAX) {
      setCountText(String(COUNT_MAX));
      onInstallmentCountChange(COUNT_MAX);
    }
  };

  return (
    <View style={styles.container}>
      {/* Başlık satırı: Radio-style buton + input */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => onToggleEnabled(!enabled)}
          style={[styles.toggleBtn, enabled && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleLabel, enabled && styles.toggleLabelActive]}>
            Taksitli Harcama
          </Text>
        </Pressable>

        <View style={styles.countWrap}>
          <TextInput
            style={[styles.countInput, !enabled && styles.countInputDisabled]}
            value={countText}
            onChangeText={handleCountChange}
            onBlur={handleCountBlur}
            keyboardType="number-pad"
            maxLength={2}
            placeholder={String(COUNT_MIN)}
            placeholderTextColor={colors.inkSoft}
            selectTextOnFocus
            editable={enabled}
          />
          <Text style={[styles.countLabel, !enabled && styles.countLabelDisabled]}>
            taksit
          </Text>
        </View>
      </View>

      {enabled && (
        <View style={styles.body}>
          {/* Tutar tipi: Toplam / Taksit Tutarı */}
          <Text style={styles.sectionLabel}>Tutar Tipi</Text>
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => onAmountModeChange('total')}
              style={[
                styles.modeBtn,
                amountMode === 'total' && styles.modeBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  amountMode === 'total' && styles.modeTextActive,
                ]}
              >
                Toplam
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onAmountModeChange('perMonth')}
              style={[
                styles.modeBtn,
                amountMode === 'perMonth' && styles.modeBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  amountMode === 'perMonth' && styles.modeTextActive,
                ]}
              >
                Taksit Tutarı
              </Text>
            </Pressable>
          </View>

          {/* Başlangıç dönemi */}
          <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
            Başlangıç
          </Text>
          <View style={styles.segmentRow}>
            <Pressable
              onPress={() => onStartNextMonthChange(false)}
              style={[
                styles.segmentBtn,
                !startNextMonth && styles.segmentBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  !startNextMonth && styles.segmentTextActive,
                ]}
              >
                Bu Ay
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onStartNextMonthChange(true)}
              style={[
                styles.segmentBtn,
                startNextMonth && styles.segmentBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  startNextMonth && styles.segmentTextActive,
                ]}
              >
                Gelecek Ay
              </Text>
            </Pressable>
          </View>

          {/* Özet — tek satır, mode'a göre */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {amountMode === 'total' ? 'Aylık' : 'Toplam'}
              </Text>
              <Text style={styles.summaryValue}>
                {amountMode === 'total' ? `${perMonthLabel} / ay` : totalLabel}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
    },

    // Header satırı: radio button + input
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    toggleBtn: {
      width: '40%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.ink,
      backgroundColor: colors.surface,
    },
    toggleBtnActive: {
      backgroundColor: colors.accent,
    },
    toggleLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: colors.ink,
    },
    toggleLabelActive: {
      color: colors.accentInk,
    },

    // Taksit sayısı input'u
    countWrap: {
      width: '40%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.sm,
    },
    countInput: {
      flex: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      color: colors.ink,
      fontFamily: fonts.heading,
      fontSize: 18,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    countInputDisabled: {
      opacity: 0.35,
      borderColor: colors.line,
    },
    countLabel: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.inkSoft,
    },
    countLabelDisabled: {
      opacity: 0.4,
    },

    // Gövde
    body: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },

    sectionLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Mode butonları (Toplam / Taksit Tutarı)
    modeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    modeBtn: {
      width: '40%',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.ink,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    modeBtnActive: {
      backgroundColor: colors.accent,
    },
    modeText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
    modeTextActive: { color: colors.accentInk },

    // Segment (Bu Ay / Gelecek Ay)
    segmentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    segmentBtn: {
      width: '40%',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.ink,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    segmentBtnActive: {
      backgroundColor: colors.accent,
    },
    segmentText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
    segmentTextActive: { color: colors.accentInk },

    // Özet kutusu
    summaryBox: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface2,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    summaryLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
    },
    summaryValue: {
      fontFamily: fonts.heading,
      fontSize: 18,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    summaryRange: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
    remainderText: {
      marginTop: spacing.xs,
      fontSize: 11,
      fontFamily: fonts.body,
      color: colors.inkSoft,
      fontStyle: 'italic',
    },
  });
