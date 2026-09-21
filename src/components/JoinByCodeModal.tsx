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
import { joinSpaceByCode } from '../lib/groupQueries';
import { colors, fonts, radius, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onJoined: () => void;
};

export default function JoinByCodeModal({ visible, onClose, onJoined }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCode('');
      setErrorMsg(null);
      setBusy(false);
    }
  }, [visible]);

  const handleJoin = useCallback(async () => {
    if (!code.trim()) {
      setErrorMsg('Lütfen davet kodunu gir.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    const result = await joinSpaceByCode(code);
    setBusy(false);

    if (!result.ok) {
      setErrorMsg(result.error);
      return;
    }

    onJoined();
    onClose();
  }, [code, onJoined, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Kod ile Katıl</Text>
          <Text style={styles.subtitle}>
            Davet edildiğin alanın 6 haneli kodunu gir.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="ÖRN. AB12CD"
            placeholderTextColor={colors.inkSoft}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            autoFocus
          />

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
              onPress={handleJoin}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.accentInk} />
              ) : (
                <Text style={styles.btnPrimaryText}>Katıl</Text>
              )}
            </Pressable>
          </View>
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
  subtitle: { color: colors.inkSoft, fontSize: 13, marginBottom: spacing.md },

  input: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 22,
    fontFamily: fonts.heading,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: spacing.md,
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

  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    fontFamily: fonts.body,
  },
  btnDisabled: { opacity: 0.6 },
  btnGhost: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnGhostText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: colors.accentInk, fontSize: 15, fontWeight: '700' },
});
