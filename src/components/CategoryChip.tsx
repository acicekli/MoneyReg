import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, spacing, useThemedStyles, type ThemeColors, useTheme } from '../theme';
import type { Category } from '../types/models';

type Props = {
  category: Category;
  selected: boolean;
  onPress: () => void;
};

export default function CategoryChip({ category, selected, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={styles.icon}>{category.icon ?? '📦'}</Text>
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {category.name}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    marginRight: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  icon: { fontSize: 16 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  labelSelected: { color: colors.accentInk },
});
