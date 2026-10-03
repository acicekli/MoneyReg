import { useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const passwordRef = useRef<any>(null);

  async function handleLogin() {
    if (!email || !password) {
      showAlert('Hata', 'E-posta ve şifre gerekli.');
      return;
    }
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      showAlert('Giriş başarısız', error);
      return;
    }
    // Giriş başarılı → "beni hatırla" bayrağını kaydet
    try {
      await AsyncStorage.setItem('remember_me', rememberMe ? 'true' : 'false');
    } catch {
      // sessiz
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
        {/* Logo / Başlık */}
        <View style={styles.header}>
          <Text style={styles.logo}>₺</Text>
          <Text style={styles.appName}>MoneyReg</Text>
          <Text style={styles.tagline}>Harcamalarını düzenli takip et</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Giriş Yap</Text>

          <Text style={styles.label}>E-posta</Text>
          <TextInput
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
            placeholder="••••••••"
            placeholderTextColor={colors.inkSoft}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <Pressable
            onPress={() => setRememberMe(!rememberMe)}
            style={styles.rememberRow}
            hitSlop={8}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.rememberLabel}>Beni hatırla</Text>
          </Pressable>

          <Pressable
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentInk} />
            ) : (
              <Text style={styles.buttonText}>Giriş Yap</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.linkRow}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>
              Hesabın yok mu?{' '}
              <Text style={styles.linkTextBold}>Kayıt ol</Text>
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
  logo: {
    fontFamily: fonts.heading,
    fontSize: 56,
    color: colors.accent,
    lineHeight: 64,
  },
  appName: {
    fontFamily: fonts.heading,
    fontSize: 32,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: spacing.xs,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.ink,
    marginBottom: spacing.lg,
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

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  rememberLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
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
