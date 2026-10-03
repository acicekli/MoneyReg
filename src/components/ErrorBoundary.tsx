import React from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

/**
 * Kök hata yakalayıcı: bir ekran çökerse beyaz ekran yerine
 * "Tekrar dene" butonu gösterir. Tema bağımsız (ThemeProvider dışında da çalışır).
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary]', error);
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#111111', marginBottom: 8 }}>
          Bir şeyler ters gitti
        </Text>
        <Text style={{ fontSize: 14, color: '#555555', textAlign: 'center', marginBottom: 20 }}>
          Beklenmeyen bir hata oluştu. Verileriniz güvende, tekrar deneyebilirsiniz.
        </Text>
        <Pressable
          onPress={this.reset}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 10,
            backgroundColor: '#111111',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Tekrar dene</Text>
        </Pressable>
      </View>
    );
  }
}
