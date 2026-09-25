// ============================================================
// MoneyReg — Tema duyarlı StyleSheet helper'ı
// Kullanım:
//   const makeStyles = (c: ThemeColors) => StyleSheet.create({ ... });
//   const styles = useThemedStyles(makeStyles);
// ============================================================

import { useMemo } from 'react';
import { useTheme } from './ThemeContext';
import type { ThemeColors } from './colors';

export function useThemedStyles<T>(
  factory: (colors: ThemeColors) => T
): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
