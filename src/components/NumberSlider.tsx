import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { fonts, spacing, useThemedStyles, type ThemeColors, useTheme } from '../theme';

type Props = {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
};

export default function NumberSlider({
  min,
  max,
  value,
  onChange,
  step = 1,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Slider'ın gösterdiği değer (drag sırasında)
  const [localValue, setLocalValue] = useState(value);

  // value dışarıdan değişirse senkronize et
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((v: number) => {
    setLocalValue(v);
  }, []);

  const handleComplete = useCallback(
    (v: number) => {
      onChange(v);
    },
    [onChange]
  );

  return (
    <View style={styles.root}>
      {/* Büyük sayı göstergesi */}
      <View style={styles.valueBox}>
        <Text style={styles.valueText}>{localValue}</Text>
      </View>

      {/* Slider + min/max etiketleri */}
      <View style={styles.sliderRow}>
        <Text style={styles.rangeLabel}>{min}</Text>
        <View style={styles.sliderWrap}>
          <Slider
            style={styles.slider}
            minimumValue={min}
            maximumValue={max}
            step={step}
            value={localValue}
            onValueChange={handleChange}
            onSlidingComplete={handleComplete}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.line}
            thumbTintColor={colors.accent}
          />
        </View>
        <Text style={styles.rangeLabel}>{max}</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  valueBox: {
    paddingVertical: spacing.md,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontFamily: fonts.heading,
    fontSize: 64,
    color: colors.accent,
    lineHeight: 72,
  },

  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  rangeLabel: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
    fontFamily: fonts.body,
  },
  sliderWrap: {
    flex: 1,
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
