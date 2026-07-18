import React, { useEffect, useMemo, useRef } from 'react';
import {
  ScrollView,
  Pressable,
  Text,
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { parseLyrics, activeLineIndex } from '@/utils/lrc';
import { Colors, Spacing, Typography } from '@/theme';

type Props = {
  raw: string;
  /** Current playback position in seconds (drives karaoke highlight). */
  position: number;
  /** Seek handler; enables tap-a-line-to-jump on synced lyrics. */
  onSeekTo?: (seconds: number) => void;
  bottomInset: number;
};

// Pause auto-scroll for a moment after the user drags, so we don't fight them.
const USER_SCROLL_GRACE_MS = 4500;

export function LyricsView({ raw, position, onSeekTo, bottomInset }: Props) {
  const parsed = useMemo(() => parseLyrics(raw), [raw]);
  const scrollRef = useRef<ScrollView>(null);
  const lineOffsets = useRef<number[]>([]);
  const containerH = useRef(0);
  const userScrollUntil = useRef(0);

  const activeIndex = useMemo(
    () => (parsed.synced ? activeLineIndex(parsed.lines, position) : -1),
    [parsed, position],
  );

  useEffect(() => {
    if (!parsed.synced || activeIndex < 0) return;
    if (Date.now() < userScrollUntil.current) return;
    const y = lineOffsets.current[activeIndex];
    if (y == null) return;
    // Keep the active line ~40% down the viewport, like Apple Music.
    scrollRef.current?.scrollTo({
      y: Math.max(0, y - containerH.current * 0.4),
      animated: true,
    });
  }, [activeIndex, parsed.synced]);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    containerH.current = e.nativeEvent.layout.height;
  };

  const onScrollBeginDrag = (_e: NativeSyntheticEvent<NativeScrollEvent>) => {
    userScrollUntil.current = Date.now() + USER_SCROLL_GRACE_MS;
  };

  if (parsed.lines.length === 0) return null;

  if (!parsed.synced) {
    const text = parsed.lines.map((l) => l.text).join('\n');
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.plainContent,
          { paddingBottom: bottomInset + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.plainText}>{text}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      onLayout={onContainerLayout}
      onScrollBeginDrag={onScrollBeginDrag}
      scrollEventThrottle={16}
      contentContainerStyle={[
        styles.syncedContent,
        { paddingBottom: bottomInset + Spacing.xxxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {parsed.lines.map((line, i) => {
        const active = i === activeIndex;
        const canSeek = onSeekTo != null && line.time != null;
        return (
          <Pressable
            key={`${i}-${line.time}`}
            onLayout={(e) => {
              lineOffsets.current[i] = e.nativeEvent.layout.y;
            }}
            onPress={canSeek ? () => onSeekTo!(line.time as number) : undefined}
            style={styles.lineRow}
          >
            <Text style={[styles.line, active ? styles.lineActive : styles.lineInactive]}>
              {line.text.length > 0 ? line.text : '♪'}
            </Text>
          </Pressable>
        );
      })}
      <View style={{ height: containerH.current * 0.5 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  plainContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  plainText: {
    fontSize: Typography.md,
    lineHeight: 30,
    color: Colors.textPrimary,
  },
  syncedContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  lineRow: {
    paddingVertical: Spacing.sm,
  },
  line: {
    fontSize: 30,
    fontWeight: Typography.heavy,
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  lineActive: {
    color: Colors.textPrimary,
  },
  lineInactive: {
    // Dimmed, matching the reference's blurred inactive lines.
    color: 'rgba(255,255,255,0.32)',
  },
});
