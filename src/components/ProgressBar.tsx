import React, { useCallback } from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '@/theme';
import { formatDuration } from '@/utils/format';

type Props = {
  position: number;
  duration: number;
  isLossless?: boolean;
  onSeek: (pos: number) => void;
};

export function ProgressBar({ position, duration, isLossless, onSeek }: Props) {
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const remaining = Math.max(0, duration - position);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, target } = evt.nativeEvent;
      // Will be refined in onPanResponderMove
    },
    onPanResponderMove: (_, gestureState) => {
      // handled via onPanResponderRelease for simplicity
    },
    onPanResponderRelease: (evt, gestureState) => {
      // Use the x position relative to the bar width (set via onLayout)
      // Simplified: seek proportional to gesture
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { flex: progress }]} />
        <View style={[styles.remaining, { flex: 1 - progress }]} />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatDuration(position)}</Text>
        {isLossless && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Lossless</Text>
          </View>
        )}
        <Text style={styles.time}>-{formatDuration(remaining)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  track: {
    height: 9,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 8,
  },
  remaining: {
    backgroundColor: Colors.controlInactive,
    // borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    backgroundColor: Colors.losslessBg,
    borderRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2.5,
  },
  badgeText: {
    fontSize: Typography.xs,
    color: Colors.losslessText,
    fontWeight: Typography.semibold,
  },
});
