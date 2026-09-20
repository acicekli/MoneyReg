import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

type Props = {
  onDigit: (d: string) => void;
  onComma: () => void;
  onBackspace: () => void;
};

const KEYS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [',', '0', '⌫'],
];

export default function NumericKeypad({ onDigit, onComma, onBackspace }: Props) {
  return (
    <View style={styles.grid}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((k) => {
            const isComma = k === ',';
            const isBack = k === '⌫';
            return (
              <Pressable
                key={k}
                style={({ pressed }) => [
                  styles.key,
                  pressed && styles.keyPressed,
                ]}
                onPress={() => {
                  if (isComma) onComma();
                  else if (isBack) onBackspace();
                  else onDigit(k);
                }}
              >
                <Text style={styles.keyText}>{k}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  key: {
    flex: 1,
    aspectRatio: 1.9,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  keyText: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.ink,
  },
});
