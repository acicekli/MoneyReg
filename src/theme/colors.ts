// ============================================================
// MoneyReg — Renk paletleri (Açık + Koyu)
// ============================================================

export type ThemeColors = {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  inkSoft: string;
  line: string;
  accent: string;
  accentInk: string;
  expense: string;
  income: string;
  watermarkOpacity: number;
  // Geriye dönük uyumluluk (eski API):
  background: string;
  surfaceAlt: string;
  positive: string;
};

export const lightTheme: ThemeColors = {
  bg: '#D8C8A3',
  surface: '#EFE4CA',
  surface2: '#E3D4B3',
  ink: '#1E2430',
  inkSoft: '#52566A',
  line: '#BBB08E',
  accent: '#C4791A',
  accentInk: '#FFFFFF',
  expense: '#A83636',
  income: '#3F7D46',
  watermarkOpacity: 0.12,

  // Eski API aliases:
  background: '#D8C8A3',
  surfaceAlt: '#E3D4B3',
  positive: '#3F7D46',
};

export const darkTheme: ThemeColors = {
  bg: '#0C0E14',
  surface: '#12141C',
  surface2: '#1D212B',
  ink: '#EFEBDD',
  inkSoft: '#A2A6B3',
  line: '#2D3342',
  accent: '#E3A934',
  accentInk: '#14171F',
  expense: '#D96666',
  income: '#7FBE6C',
  watermarkOpacity: 0.15,

  // Eski API aliases:
  background: '#0C0E14',
  surfaceAlt: '#1D212B',
  positive: '#7FBE6C',
};
