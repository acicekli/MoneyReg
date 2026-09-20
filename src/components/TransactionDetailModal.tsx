import { useCallback, useEffect, useState } from 'react';
import { formatCurrency, formatExpenseAmount, formatAmount as fmtAmount, formatPercent } from '../lib/format';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { transactionAmountInTRY, type Transaction } from '../types/models';
import { getSignedReceiptUrl } from '../lib/receiptsStorage';
import { useNetworkStatus } from '../lib/networkContext';
import { colors, fonts, radius, spacing } from '../theme';

// ============================================================
// Harcama Detay Modalı
// - Normal mod: detay bilgileri + "Fişi Gör" butonu
// - Fiş modu: tam ekran fiş görseli + "Geri" butonu
// ============================================================

type Props = {
  visible: boolean;
  transaction: (Transaction & {
    category_name?: string | null;
    category_icon?: string | null;
    payer_display_name?: string;
  }) | null;
  spaceName?: string;
  onClose: () => void;
  onEdit?: () => void;
};



function formatDateTR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export default function TransactionDetailModal({
  visible,
  transaction,
  spaceName,
  onClose,
  onEdit,
}: Props) {
  const { isOnline } = useNetworkStatus();
  const [viewingReceipt, setViewingReceipt] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // Modal açıldığında fiş modunu sıfırla
  useEffect(() => {
    if (visible) {
      setViewingReceipt(false);
      setReceiptUrl(null);
      setReceiptError(null);
    }
  }, [visible]);

  // Fiş modu açıldığında URL al
  useEffect(() => {
    if (!viewingReceipt || !transaction?.receipt_photo_url) return;

    const path = transaction.receipt_photo_url;

    // Local URI veya tam URL ise doğrudan göster
    if (
      path.startsWith('file://') ||
      path.startsWith('blob:') ||
      path.startsWith('data:') ||
      path.startsWith('http://') ||
      path.startsWith('https://')
    ) {
      setReceiptUrl(path);
      return;
    }

    // Storage path → signed URL
    setLoadingReceipt(true);
    setReceiptError(null);
    setReceiptUrl(null);

    getSignedReceiptUrl(path, 60).then((result) => {
      if (result.ok) {
        setReceiptUrl(result.url);
      } else {
        setReceiptError(result.error);
      }
      setLoadingReceipt(false);
    });
  }, [viewingReceipt, transaction?.receipt_photo_url]);

  const handleClose = useCallback(() => {
    if (viewingReceipt) {
      // Fiş modundan detay moduna dön
      setViewingReceipt(false);
      setReceiptUrl(null);
      setReceiptError(null);
    } else {
      onClose();
    }
  }, [viewingReceipt, onClose]);

  if (!transaction) return null;

  const t = transaction;
  const tryValue = transactionAmountInTRY(t);
  const isForeign = t.currency !== 'TRY';
  const hasReceipt = !!t.receipt_photo_url;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
        >
          {viewingReceipt ? (
            /* ==================== FİŞ MODU ==================== */
            <>
              <Text style={styles.title}>Fiş Fotoğrafı</Text>

              <View style={styles.receiptViewer}>
                {loadingReceipt ? (
                  <ActivityIndicator size="large" color={colors.accent} />
                ) : receiptError ? (
                  <Text style={styles.errorText}>{receiptError}</Text>
                ) : receiptUrl ? (
                  <Image
                    source={{ uri: receiptUrl }}
                    style={styles.receiptImage}
                    resizeMode="contain"
                  />
                ) : null}
              </View>

              <Pressable
                style={[styles.btn, styles.btnGhost, { marginTop: spacing.md }]}
                onPress={handleClose}
              >
                <Text style={styles.btnGhostText}>Geri</Text>
              </Pressable>
            </>
          ) : (
            /* ==================== DETAY MODU ==================== */
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Başlık */}
              <View style={styles.headerRow}>
                <Text style={styles.headerIcon}>{t.category_icon ?? '📦'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {t.category_name ?? 'Kategorisiz'}
                  </Text>
                  <Text style={styles.headerSub} numberOfLines={1}>
                    {formatDateTR(t.expense_date)}
                    {spaceName ? ` · ${spaceName}` : ''}
                  </Text>
                </View>
              </View>

              {/* Tutar */}
              <View style={styles.amountBox}>
                <Text style={styles.amountValue}>
                  -{formatCurrency(t.amount, t.currency)}
                </Text>
                {isForeign && (
                  <Text style={styles.amountTry}>≈ {formatCurrency(tryValue)}</Text>
                )}
              </View>

              {/* Meta */}
              <View style={styles.metaBox}>
                {t.payer_display_name ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>👤 Ödeyen</Text>
                    <Text style={styles.metaValue}>{t.payer_display_name}</Text>
                  </View>
                ) : null}

                {t.note ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>📝 Not</Text>
                    <Text style={styles.metaValue} numberOfLines={3}>{t.note}</Text>
                  </View>
                ) : null}
              </View>

              {/* Fiş butonu */}
              {hasReceipt && (() => {
                // Storage path (online gerektirir) mi yoksa local URI mi?
                const path = t.receipt_photo_url as string;
                const isLocalOrUrl =
                  path.startsWith('file://') ||
                  path.startsWith('blob:') ||
                  path.startsWith('data:') ||
                  path.startsWith('http://') ||
                  path.startsWith('https://');

                // Offline + Storage path → disabled
                const requiresOnline = !isOnline && !isLocalOrUrl;

                if (requiresOnline) {
                  return (
                    <View style={[styles.receiptBtn, styles.receiptBtnDisabled]}>
                      <Text style={styles.receiptBtnDisabledText}>
                        📎 Fiş (çevrimiçi olunca görüntülenebilir)
                      </Text>
                    </View>
                  );
                }

                return (
                  <Pressable
                    style={styles.receiptBtn}
                    onPress={() => setViewingReceipt(true)}
                  >
                    <Text style={styles.receiptBtnText}>📎 Fişi Gör</Text>
                  </Pressable>
                );
              })()}

              {/* Aksiyonlar */}
              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.btn, styles.btnGhost]}
                  onPress={onClose}
                >
                  <Text style={styles.btnGhostText}>Kapat</Text>
                </Pressable>

                {onEdit && (
                  <Pressable
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={onEdit}
                  >
                    <Text style={styles.btnPrimaryText}>Düzenle</Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
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
    marginBottom: spacing.md,
  },

  // Detay
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerIcon: { fontSize: 40 },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.ink,
  },
  headerSub: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },

  amountBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  amountValue: {
    fontFamily: fonts.heading,
    fontSize: 36,
    color: colors.ink,
  },
  amountTry: { color: colors.inkSoft, fontSize: 13, marginTop: spacing.xs },

  metaBox: { gap: spacing.md, marginBottom: spacing.lg },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metaLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  metaValue: {
    color: colors.ink,
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },

  receiptBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  receiptBtnText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  receiptBtnDisabled: {
    opacity: 0.6,
    backgroundColor: colors.surfaceAlt,
  },
  receiptBtnDisabledText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  btnRow: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnGhostText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: colors.accentInk, fontSize: 15, fontWeight: '700' },

  // Fiş görüntüleyici
  receiptViewer: {
    width: '100%',
    height: 400,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  errorText: {
    color: colors.expense,
    fontSize: 13,
    textAlign: 'center',
    padding: spacing.md,
  },
});
