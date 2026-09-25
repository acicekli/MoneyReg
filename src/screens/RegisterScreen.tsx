import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { showAlert } from '../lib/alertHelper';
import { fonts, radius, spacing, useThemedStyles, type ThemeColors, useTheme } from '../theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);

  async function handleRegister() {
    if (!fullName || !email || !password) {
      showAlert('Hata', 'Tüm alanları doldur.');
      return;
    }
    if (password.length < 6) {
      showAlert('Hata', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    setBusy(true);
    const { error } = await signUp(email.trim(), password, fullName.trim());
    setBusy(false);
    if (error) {
      showAlert('Kayıt başarısız', error);
    } else {
      showAlert(
        'Başarılı',
        'Kayıt oluşturuldu. E-postanı doğrulaman gerekebilir, ardından giriş yapabilirsin.'
      );
      navigation.navigate('Login');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.appName}>Hesap Oluştur</Text>
          <Text style={styles.tagline}>
            Harcamalarını takip etmeye başla
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Ad Soyad</Text>
          <TextInput
            style={styles.input}
            placeholder="Adın Soyadın"
            placeholderTextColor={colors.inkSoft}
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            blurOnSubmit={false}
          />

          <Text style={styles.label}>E-posta</Text>
          <TextInput
            ref={emailRef}
            style={styles.input}
            placeholder="ornek@email.com"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Şifre</Text>
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="En az 6 karakter"
            placeholderTextColor={colors.inkSoft}
            secureTextEntry
            autoComplete="password-new"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={handleRegister}
          />

          <Pressable
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentInk} />
            ) : (
              <Text style={styles.buttonText}>Kayıt Ol</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.linkRow}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.linkText}>
              Zaten hesabın var mı?{' '}
              <Text style={styles.linkTextBold}>Giriş yap</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  appName: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.ink,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },

  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.ink,
    marginBottom: spacing.md,
  },

  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: colors.accentInk,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },

  linkRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  linkText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  linkTextBold: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
  },
});
