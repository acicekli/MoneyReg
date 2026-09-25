// ============================================================
// MoneyReg — Global navigation ref
// Bildirim response'undan navigate yapabilmek için
// ============================================================

import { createNavigationContainerRef } from '@react-navigation/native';
import type { MainTabParamList } from './types';

export const navigationRef = createNavigationContainerRef<MainTabParamList>();
