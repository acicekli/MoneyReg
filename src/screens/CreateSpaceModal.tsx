import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../lib/auth-context';
import { createSharedSpace } from '../lib/groupQueries';
import { colors, fonts, radius, spacing } from '../theme';

export default function CreateSpaceModal() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleCreate() {
    if (!user) {
      setErrorMsg('Kullanıcı oturumu bulunamadı.');
      return;
    }
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Lütfen alan adı gir.');
      return;
    }

    setBusy(true);
    const result = await createSharedSpace(user.id, name);
    setBusy(false);

    if (!result.ok) {
      setErrorMsg(result.error);
      return;
    }
    navigation.goBack();
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.label}>Yeni alan adı</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn. Ev Arkadaşları"
          placeholderTextColor={colors.inkSoft}
          value={name}
          onChangeText={setName}
          maxLength={60}
          autoFocus
        />

        <Text style={styles.hint}>
          Oluşturduğunda otomatik olarak bu alanın üyesi olursun.
        </Text>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.accentInk} />
          ) : (
            <Text style={styles.buttonText}>Oluştur</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  label: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  hint: { color: colors.inkSoft, fontSize: 12, lineHeight: 16 },
  errorBox: {
    backgroundColor: '#F8E1E1',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.expense,
    padding: spacing.md,
  },
  errorText: { color: colors.expense, fontSize: 13 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.accentInk, fontSize: 16, fontWeight: '700' },
});
