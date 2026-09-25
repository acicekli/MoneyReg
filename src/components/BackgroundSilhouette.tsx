// ============================================================
// MoneyReg — Arka plan silüeti
// Her ekranda köşede çok düşük opaklıkta büyük bir ikon
// ============================================================

import { StyleSheet, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useThemedStyles, type ThemeColors, useTheme } from '../theme';

type SilhouetteType =
  | 'wallet'         // HomeScreen
  | 'receipt'        // AddExpenseScreen
  | 'house'          // GroupsScreen
  | 'people'         // GroupDetailScreen
  | 'airplane'       // ClosingReportScreen
  | 'person'         // PersonDetailScreen
  | 'compass';       // ReportsScreen

type Props = {
  type: SilhouetteType;
  size?: number;
  opacity?: number;
  /** Döndürme açısı (derece) */
  rotation?: number;
};

export default function BackgroundSilhouette({
  type,
  size = 300,
  opacity = 0.08,
  rotation = 15,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          transform: [{ rotate: `${rotation}deg` }],
        },
      ]}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill={colors.accent}
        opacity={opacity}
      >
        {type === 'wallet' && (
          <>
            <Path d="M20 60 H180 V172 H20 Z" />
            <Path d="M20 60 H180 V92 H20 Z" />
            <Circle cx="150" cy="118" r="11" />
          </>
        )}

        {type === 'receipt' && (
          <Path d="M50 20 H150 V170 L138 160 L126 170 L114 160 L102 170 L90 160 L78 170 L66 160 L54 170 Z" />
        )}

        {type === 'house' && (
          <Path d="M100 25 L182 100 H160 V172 H40 V100 H18 Z" />
        )}

        {type === 'people' && (
          <>
            <Circle cx="78" cy="60" r="26" />
            <Path d="M38 172 Q38 112 78 112 Q118 112 118 172 Z" />
            <Circle cx="136" cy="72" r="22" opacity="0.75" />
            <Path d="M100 176 Q100 128 136 128 Q172 128 172 176 Z" opacity="0.75" />
          </>
        )}

        {type === 'airplane' && (
          <Path d="M96 10 L104 10 L108 90 L180 130 L180 142 L108 118 L104 175 L118 190 L118 198 L100 192 L82 198 L82 190 L96 175 L92 118 L20 142 L20 130 L92 90 Z" />
        )}

        {type === 'person' && (
          <>
            <Circle cx="100" cy="58" r="34" />
            <Path d="M38 192 Q38 108 100 108 Q162 108 162 192 Z" />
          </>
        )}

        {type === 'compass' && (
          <>
            <Circle
              cx="100"
              cy="100"
              r="82"
              fill="none"
              stroke={colors.accent}
              strokeWidth="7"
            />
            <Path d="M100 38 L114 96 L100 110 L86 96 Z" />
            <Path d="M100 162 L86 104 L100 90 L114 104 Z" opacity="0.6" />
          </>
        )}
      </Svg>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    position: 'absolute',
    right: -80,   // kısmen kırpılmış (ekran dışına taşsın)
    bottom: -60,
    zIndex: -1,
  },
});
