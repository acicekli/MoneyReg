// ============================================================
// MoneyReg — Tema tokenları
// NOT: Uygulama SADECE harcama takip eder. Gelir kavramı yoktur.
// ============================================================

export const colors = {
  background: '#EEE6D0',
  surface:    '#FFFEFA',
  surfaceAlt: '#F4EEDB',
  ink:        '#1E2430',
  inkSoft:    '#52566A',
  line:       '#DDD3B0',
  accent:     '#C4791A',
  accentInk:  '#FFFFFF',
  expense:    '#A83636',   // SADECE "Sil" butonu ve ileride bütçe aşımı için
  positive:   '#3F7D46',   // Alacak (pozitif bakiye)
} as const;

export const fonts = {
  heading:     'Fraunces_700Bold',
  headingReg:  'Fraunces_400Regular',
  body:        'IBMPlexSans_400Regular',
  bodyMedium:  'IBMPlexSans_500Medium',
  bodyBold:    'IBMPlexSans_600SemiBold',
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
} as const;

export const radius = {
  sm: 6, md: 10, lg: 16, pill: 999,
} as const;

export const theme = { colors, fonts, spacing, radius } as const;
export type Theme = typeof theme;
