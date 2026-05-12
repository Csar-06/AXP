import React, { useRef, useState } from 'react';
import {
  View,
  Animated,
  PanResponder,
  StyleSheet,
  type GestureResponderEvent,
} from 'react-native';
import { Colors, Spacing, Typography } from '@/theme';
import { formatDuration } from '@/utils/format';

type Props = {
  position: number;
  duration: number;
  isLossless?: boolean;
  onSeek: (pos: number) => void;
};

export function ProgressBar({ position, duration, isLossless, onSeek }: Props) {
  // While the finger is down we show a local scrub position instead of the
  // live `position` prop. This avoids the bar flickering as TrackPlayer
  // reports back stale/zero positions during a seek.
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);

  const displayPosition = scrubPosition ?? position;
  const progress = duration > 0 ? Math.min(displayPosition / duration, 1) : 0;
  const remaining = Math.max(0, duration - displayPosition);

  // Refs so the one-time PanResponder always sees current values.
  const trackRef = useRef<View>(null);
  const barXRef = useRef(0);
  const barWidthRef = useRef(0);
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const scrubPositionRef = useRef<number | null>(null);

  // Single animated value: 0 = resting, 1 = pressed
  const pressAnim = useRef(new Animated.Value(0)).current;

  // Use scaleY instead of animating `height` directly: `height` is not
  // supported by the native animated module (RN logs a warning every frame)
  // and animating it also pushes the time row 8 px down. scaleY keeps the
  // layout stable and the bar grows symmetrically from its center.
  const animatedTrackScaleY = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2],
  });

  const animatedTimeColor = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.textSecondary, Colors.textPrimary],
  });

  const springConfig = { tension: 280, friction: 18, useNativeDriver: false } as const;

  const pressIn = () =>
    Animated.spring(pressAnim, { toValue: 1, ...springConfig }).start();

  const pressOut = () =>
    Animated.spring(pressAnim, { toValue: 0, ...springConfig }).start();

  const computePositionFromPageX = (pageX: number): number => {
    const width = barWidthRef.current;
    if (width <= 0) return scrubPositionRef.current ?? 0;
    const ratio = Math.max(0, Math.min(1, (pageX - barXRef.current) / width));
    return ratio * durationRef.current;
  };

  const updateScrub = (next: number) => {
    scrubPositionRef.current = next;
    setScrubPosition(next);
  };

  const measureBar = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      barXRef.current = x;
      if (w > 0) barWidthRef.current = w;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Prevent the FullPlayer's dismiss Pan gesture (or any parent
      // responder) from stealing the scrub mid-drag.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        pressIn();
        measureBar();
        // For the initial press use pageX (absolute) so we don't rely on
        // whichever child element `locationX` ended up relative to.
        const initial = computePositionFromPageX(evt.nativeEvent.pageX);
        updateScrub(initial);
      },
      onPanResponderMove: (_, gestureState) => {
        // moveX is the current absolute screen X of the active touch.
        updateScrub(computePositionFromPageX(gestureState.moveX));
      },
      onPanResponderRelease: () => {
        const finalPos = scrubPositionRef.current;
        pressOut();
        if (finalPos !== null) {
          // Only seek once, on release — this stops the rapid
          // pause/resume cycle that happens when TrackPlayer is asked to
          // seek dozens of times per second while playing.
          onSeekRef.current(finalPos);
        }
        scrubPositionRef.current = null;
        setScrubPosition(null);
      },
      onPanResponderTerminate: () => {
        pressOut();
        scrubPositionRef.current = null;
        setScrubPosition(null);
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      {/* Touch target with extra vertical padding so the thin bar is easy to tap */}
      <View style={styles.trackHitArea} {...panResponder.panHandlers}>
        <Animated.View
          ref={trackRef}
          style={[styles.track, { transform: [{ scaleY: animatedTrackScaleY }] }]}
          onLayout={(e) => {
            barWidthRef.current = e.nativeEvent.layout.width;
            // Refresh the bar's screen-X too; layout can change with
            // orientation, modals, etc.
            measureBar();
          }}
        >
          <View style={[styles.fill, { flex: progress }]} />
          <View style={[styles.remaining, { flex: 1 - progress }]} />
        </Animated.View>
      </View>

      <View style={styles.timeRow}>
        <Animated.Text style={[styles.time, { color: animatedTimeColor }]}>
          {formatDuration(displayPosition)}
        </Animated.Text>
        {isLossless && (
          <View style={styles.badge}>
            <Animated.Text style={styles.badgeText}>Lossless</Animated.Text>
          </View>
        )}
        <Animated.Text style={[styles.time, { color: animatedTimeColor }]}>
          -{formatDuration(remaining)}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xxl,
  },
  trackHitArea: {
    paddingVertical: 8,
    justifyContent: 'center',
  },
  track: {
    height: 8,
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
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: Typography.sm,
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
