import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  ScrollView,
  Pressable,
  Text,
  View,
  Animated,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import { parseLyrics, activeLineIndex, type LyricLine } from '@/utils/lrc';
import { Colors, Spacing, Typography } from '@/theme';

type Props = {
  raw: string;
  /** Current playback position in seconds (drives karaoke highlight). */
  position: number;
  /** Seek handler; enables tap-a-line-to-jump on synced lyrics. */
  onSeekTo?: (seconds: number) => void;
  bottomInset: number;
};

// After the user scrolls, blur (and auto-scroll) stay off for this long.
const BROWSE_GRACE_MS = 5000;
// Unblur is near-instant when the user starts scrolling; re-blur eases back in.
const UNBLUR_MS = 5;
const REBLUR_MS = 350;

type LineItemProps = {
  line: LyricLine;
  index: number;
  active: boolean;
  /** Shared 1 = blurred, 0 = unblurred (browsing). */
  blurAnim: Animated.Value;
  onSeekTo?: (seconds: number) => void;
  onMeasure: (index: number, y: number) => void;
};

const LyricLineItem = memo(function LyricLineItem({
  line,
  index,
  active,
  blurAnim,
  onSeekTo,
  onMeasure,
}: LineItemProps) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    // Apple-Music-style "push": a lively spring rather than a symmetric ease.
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      stiffness: 220,
      damping: 18,
      mass: 1,
    }).start();
  }, [active, anim]);

  const { scale, activeOpacity, blurredOpacity, dimOpacity } = useMemo(() => {
    const inactiveOpacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    });
    return {
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
      activeOpacity: anim,
      // Inactive glyphs cross-fade between blurred and sharp-dim as blurAnim moves.
      blurredOpacity: Animated.multiply(inactiveOpacity, blurAnim),
      dimOpacity: Animated.multiply(
        inactiveOpacity,
        Animated.subtract(1, blurAnim),
      ),
    };
  }, [anim, blurAnim]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => onMeasure(index, e.nativeEvent.layout.y),
    [index, onMeasure],
  );
  const handlePress = useCallback(() => {
    if (onSeekTo && line.time != null) onSeekTo(line.time);
  }, [onSeekTo, line.time]);

  const display = line.text.length > 0 ? line.text : '♪';

  return (
    <Pressable onPress={handlePress} onLayout={handleLayout} style={styles.lineRow}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {/* Sharp-dim base (also defines the row height). */}
        <Animated.Text style={[styles.line, styles.lineDim, { opacity: dimOpacity }]}>
          {display}
        </Animated.Text>
        {/* Blurred overlay. */}
        <Animated.Text
          style={[styles.line, styles.lineBlurred, styles.lineOverlay, { opacity: blurredOpacity }]}
        >
          {display}
        </Animated.Text>
        {/* Active (bright) overlay. */}
        <Animated.Text
          style={[styles.line, styles.lineActive, styles.lineOverlay, { opacity: activeOpacity }]}
        >
          {display}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
});

export function LyricsView({ raw, position, onSeekTo, bottomInset }: Props) {
  const parsed = useMemo(() => parseLyrics(raw), [raw]);
  const scrollRef = useRef<ScrollView>(null);
  const lineOffsets = useRef<number[]>([]);
  const containerH = useRef(0);
  const userScrollUntil = useRef(0);
  const reapplyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurAnim = useRef(new Animated.Value(1)).current;

  const activeIndex = useMemo(
    () => (parsed.synced ? activeLineIndex(parsed.lines, position) : -1),
    [parsed, position],
  );
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const handleMeasure = useCallback((i: number, y: number) => {
    lineOffsets.current[i] = y;
  }, []);

  const scrollToActive = useCallback(() => {
    const i = activeIndexRef.current;
    if (i < 0) return;
    const y = lineOffsets.current[i];
    if (y == null) return;
    // Keep the active line ~40% down the viewport, like Apple Music.
    scrollRef.current?.scrollTo({
      y: Math.max(0, y - containerH.current * 0.4),
      animated: true,
    });
  }, []);

  // Auto-scroll on line change, unless the user is browsing (or within the
  // grace window after they stopped).
  useEffect(() => {
    if (!parsed.synced || activeIndex < 0) return;
    if (Date.now() < userScrollUntil.current) return;
    scrollToActive();
  }, [activeIndex, parsed.synced, scrollToActive]);

  const beginBrowsing = useCallback(() => {
    if (reapplyTimer.current) {
      clearTimeout(reapplyTimer.current);
      reapplyTimer.current = null;
    }
    userScrollUntil.current = Date.now() + BROWSE_GRACE_MS;
    Animated.timing(blurAnim, {
      toValue: 0,
      duration: UNBLUR_MS,
      useNativeDriver: true,
    }).start();
  }, [blurAnim]);

  // Re-arm blur + auto-scroll only after the user has been idle for the grace
  // window; each scroll gesture pushes the threshold back.
  const scheduleReapply = useCallback(() => {
    if (reapplyTimer.current) clearTimeout(reapplyTimer.current);
    userScrollUntil.current = Date.now() + BROWSE_GRACE_MS;
    reapplyTimer.current = setTimeout(() => {
      reapplyTimer.current = null;
      Animated.timing(blurAnim, {
        toValue: 1,
        duration: REBLUR_MS,
        useNativeDriver: true,
      }).start();
      scrollToActive();
    }, BROWSE_GRACE_MS);
  }, [blurAnim, scrollToActive]);

  useEffect(
    () => () => {
      if (reapplyTimer.current) clearTimeout(reapplyTimer.current);
    },
    [],
  );

  const onContainerLayout = (e: LayoutChangeEvent) => {
    containerH.current = e.nativeEvent.layout.height;
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
      onScrollBeginDrag={beginBrowsing}
      onScrollEndDrag={scheduleReapply}
      onMomentumScrollEnd={scheduleReapply}
      scrollEventThrottle={16}
      contentContainerStyle={[
        styles.syncedContent,
        { paddingBottom: bottomInset + Spacing.xxxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {parsed.lines.map((line, i) => (
        <LyricLineItem
          key={`${i}-${line.time}`}
          line={line}
          index={i}
          active={i === activeIndex}
          blurAnim={blurAnim}
          onSeekTo={onSeekTo}
          onMeasure={handleMeasure}
        />
      ))}
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
  // Overlays sit on top of the sharp-dim base; the three layers cross-fade.
  lineOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  lineActive: {
    color: Colors.textPrimary,
  },
  // Blurred look: transparent glyphs with a soft white shadow.
  lineBlurred: {
    color: 'transparent',
    textShadowColor: 'rgba(255,255,255,0.42)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  // Browsing look: sharp but dimmed, so lines stay readable while scrolling.
  lineDim: {
    color: 'rgba(255,255,255,0.4)',
  },
});
