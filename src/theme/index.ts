// ============================================================
// MoneyReg — Theme public API
// Hem eski (statik colors) hem yeni (useTheme) API'yi sunar
// ============================================================

export { lightTheme, darkTheme } from './colors';
export type { ThemeColors } from './colors';
export { fonts, spacing, radius } from './tokens';
export { ThemeProvider, useTheme } from './ThemeContext';
export { useThemedStyles } from './useThemedStyles';
export type { ThemeMode } from './ThemeContext';

// ──────────────────────────────────────────────────────────
// GERİYE DÖNÜK UYUMLULUK
// Eski kod `colors.ink`, `theme.colors` gibi kullanıyor.
// Bu sabit, LIGHT temayı default olarak verir — mevcut 36
// dosya bozulmaz. Yeni kod `useTheme()` kullanmalı.
// ──────────────────────────────────────────────────────────
import { lightTheme } from './colors';
import { fonts, spacing, radius } from './tokens';

export const colors = lightTheme;

export const theme = {
  colors: lightTheme,
  fonts,
  spacing,
  radius,
} as const;

export type Theme = typeof theme;
