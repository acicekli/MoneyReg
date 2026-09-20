// ============================================================
// MoneyReg — Alert helper (web uyumlu)
// React Native Web'de Alert.alert no-op olduğu için
// web'de window.alert kullanır.
// ============================================================

import { Alert, Platform } from 'react-native';

export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    // Web'de window.alert
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined') {
      window.alert(text);
    }
  } else {
    Alert.alert(title, message);
  }
}
