import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '@/theme';

type Props = {
  count: number;
  label: string;
  sortLabel?: string;
  onSortPress?: () => void;
};

export function ListHeader({ count, label, sortLabel, onSortPress }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.count}>
        {count} {label}
      </Text>
      {sortLabel && onSortPress && (
        <Pressable onPress={onSortPress} hitSlop={8} style={styles.sortBtn}>
          <Text style={styles.sortLabel}>↑ {sortLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  count: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortLabel: {
    fontSize: Typography.sm,
    color: Colors.accent,
    fontWeight: Typography.medium,
  },
});
