import { useCallback, useRef } from 'react';
import { formatCurrency, formatExpenseAmount, formatAmount as fmtAmount, formatPercent } from '../lib/format';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { transactionAmountInTRY, type Transaction } from '../types/models';
import { fonts, radius, spacing, useThemedStyles, type ThemeColors } from '../theme';

// ============================================================
// Ortak transaction listesi
// - Tap → detay modalı (onPress)
// - Swipe → Düzenle / Sil (sadece kendi kayıtların)
// - Aynı anda sadece bir satır swipe açık olabilir
// ============================================================

export type TransactionListItem = Transaction & {
  payer_display_name?: string;
  category_name?: string | null;
  category_icon?: string | null;
};

type Props = {
  transactions: TransactionListItem[];
  showPayer?: boolean;
  showCategory?: boolean;
  emptyMessage?: string;
  onPress?: (t: TransactionListItem) => void;
  editable?: boolean;
  currentUserId?: string;
  onEdit?: (t: TransactionListItem) => void;
  onDelete?: (t: TransactionListItem) => void;
};



export default function TransactionList({
  transactions,
  showPayer = false,
  showCategory = true,
  emptyMessage = 'Henüz harcama yok.',
  onPress,
  editable = false,
  currentUserId,
  onEdit,
  onDelete,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  // Aynı anda tek Swipeable açık olsun
  const openRowRef = useRef<Swipeable | null>(null);

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptySub}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View>
      {transactions.map((t) => {
        const isOwn = currentUserId && t.created_by === currentUserId;
        const swipeEnabled = editable && isOwn;

        return (
          <TransactionRow
            key={t.id}
            t={t}
            showPayer={showPayer}
            showCategory={showCategory}
            onPress={onPress}
            swipeEnabled={!!swipeEnabled}
            onEdit={onEdit}
            onDelete={onDelete}
            openRowRef={openRowRef}
          />
        );
      })}
    </View>
  );
}

// ---------- Tek satır ----------

type RowProps = {
  t: TransactionListItem;
  showPayer: boolean;
  showCategory: boolean;
  onPress?: (t: TransactionListItem) => void;
  swipeEnabled: boolean;
  onEdit?: (t: TransactionListItem) => void;
  onDelete?: (t: TransactionListItem) => void;
  openRowRef: React.MutableRefObject<Swipeable | null>;
};

function TransactionRow({
  t,
  showPayer,
  showCategory,
  onPress,
  swipeEnabled,
  onEdit,
  onDelete,
  openRowRef,
}: RowProps) {
  const styles = useThemedStyles(makeStyles);
  const tryValue = transactionAmountInTRY(t);
  const isForeign = t.currency !== 'TRY';
  const headerIcon = showCategory ? t.category_icon ?? '📦' : null;
  const headerText = showCategory ? t.category_name ?? 'Kategorisiz' : null;
  const hasReceipt = !!t.receipt_photo_url;

  const swipeableRef = useRef<Swipeable | null>(null);

  const handlePress = useCallback(() => {
    // Eğer başka bir satır açıksa önce onu kapat
    if (openRowRef.current && openRowRef.current !== swipeableRef.current) {
      openRowRef.current.close();
      openRowRef.current = null;
    }
    onPress?.(t);
  }, [onPress, t, openRowRef]);

  const renderRightActions = useCallback(() => {
    return (
      <View style={styles.actionsWrap}>
        <RectButton
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => {
            // Swipe'ı kapat
            swipeableRef.current?.close();
            openRowRef.current = null;
            onEdit?.(t);
          }}
        >
          <Text style={styles.actionBtnText}>Düzenle</Text>
        </RectButton>
        <RectButton
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => {
            swipeableRef.current?.close();
            openRowRef.current = null;
            onDelete?.(t);
          }}
        >
          <Text style={styles.actionBtnText}>Sil</Text>
        </RectButton>
      </View>
    );
  }, [t, onEdit, onDelete, openRowRef]);

  const rowContent = (
    <View style={styles.txRow}>
      <View style={styles.txLeft}>
        {showCategory && (
          <View style={styles.titleRow}>
            <Text style={styles.txTitle} numberOfLines={1}>
              {headerIcon} {headerText}
            </Text>
            {hasReceipt && (
              <Pressable
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onPress?.(t);  // karta tap gibi davran
                }}
                hitSlop={8}
                style={styles.receiptBtn}
              >
                <Text style={styles.receiptIcon}>📎</Text>
              </Pressable>
            )}
          </View>
        )}

        {t.note ? (
          <Text style={styles.txNote} numberOfLines={1}>{t.note}</Text>
        ) : null}

        <Text style={styles.txDate}>{t.expense_date}</Text>
      </View>

      <View style={styles.txRight}>
        <Text style={styles.txAmount}>-{formatCurrency(t.amount, t.currency)}</Text>
        {isForeign && <Text style={styles.txTry}>≈ {formatCurrency(tryValue)}</Text>}
        {showPayer && t.payer_display_name ? (
          <Text style={styles.txPayer} numberOfLines={1}>{t.payer_display_name} ödedi</Text>
        ) : null}
      </View>
    </View>
  );

  if (!swipeEnabled) {
    return (
      <Pressable onPress={handlePress} style={{ marginBottom: spacing.sm }}>
        {rowContent}
      </Pressable>
    );
  }

  return (
    <Swipeable
      ref={(ref) => { swipeableRef.current = ref; }}
      renderRightActions={renderRightActions}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        // Başka bir satır açıksa kapat
        if (openRowRef.current && openRowRef.current !== swipeableRef.current) {
          openRowRef.current.close();
        }
        openRowRef.current = swipeableRef.current;
      }}
      onSwipeableClose={() => {
        if (openRowRef.current === swipeableRef.current) {
          openRowRef.current = null;
        }
      }}
    >
      <Pressable onPress={handlePress}>{rowContent}</Pressable>
    </Swipeable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  txLeft: { flex: 1, marginRight: spacing.md },
  txRight: { alignItems: 'flex-end', maxWidth: '45%' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  txTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  receiptBtn: { padding: 2 },
  receiptIcon: { fontSize: 14 },

  txNote: { color: colors.inkSoft, fontSize: 11, marginTop: 2 },
  txDate: { color: colors.inkSoft, fontSize: 11, marginTop: 4 },

  txAmount: { fontSize: 16, fontWeight: '700', color: colors.ink },
  txTry: { color: colors.inkSoft, fontSize: 11, marginTop: 2 },
  txPayer: { color: colors.inkSoft, fontSize: 11, marginTop: 4, textAlign: 'right' },

  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
    fontFamily: fonts.body,
  },
  actionBtn: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    marginLeft: spacing.xs,
  },
  editBtn: { backgroundColor: colors.accent },
  deleteBtn: { backgroundColor: colors.expense },
  actionBtnText: {
    color: colors.accentInk,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },

  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    alignItems: 'center',
    fontFamily: fonts.body,
  },
  emptySub: { color: colors.inkSoft, fontSize: 14 },
});
