import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArtworkImage } from '@/components/ArtworkImage';
import { ProgressBar } from '@/components/ProgressBar';
import { usePlayerStore } from '@/store/playerStore';
import { useThemeStore } from '@/store/themeStore';
import { RepeatMode } from '@/audio/TrackPlayerSetup';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FullPlayer'>;

export function FullPlayerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const playerBg = useThemeStore((s) => s.playerBg);
  const playerBgSecondary = useThemeStore((s) => s.playerBgSecondary);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);

  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const seek = usePlayerStore((s) => s.seek);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);

  const repeatIcon =
    repeatMode === RepeatMode.Off
      ? '↻'
      : repeatMode === RepeatMode.Queue
      ? '↻'
      : '①';
  const repeatActive = repeatMode !== RepeatMode.Off;

  const handleQueuePress = useCallback(() => {
    navigation.navigate('QueueView');
  }, [navigation]);

  if (!currentTrack) return null;

  return (
    <LinearGradient
      colors={[playerBg, playerBgSecondary, '#000000']}
      locations={[0, 0.5, 1]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.headerChevron}>⌄</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Reproduciendo</Text>
        <Pressable hitSlop={12}>
          <Text style={styles.headerMore}>···</Text>
        </Pressable>
      </View>

      {/* Album art */}
      <View style={styles.artworkWrapper}>
        <ArtworkImage
          uri={currentTrack.artworkUri}
          size={300}
          radius={Radius.lg}
          style={styles.artwork}
        />
      </View>

      {/* Track info */}
      <View style={styles.infoRow}>
        <View style={styles.infoText}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>
        <Pressable hitSlop={10}>
          <Text style={styles.starIcon}>☆</Text>
        </Pressable>
      </View>

      {/* Progress */}
      <ProgressBar
        position={position}
        duration={duration}
        isLossless={currentTrack.isLossless}
        onSeek={seek}
      />

      {/* Main controls */}
      <View style={styles.controls}>
        <Pressable onPress={previous} hitSlop={10}>
          <Text style={styles.controlIcon}>⏮</Text>
        </Pressable>
        <Pressable
          onPress={togglePlayPause}
          style={styles.playBtn}
          hitSlop={4}
        >
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>
        <Pressable onPress={next} hitSlop={10}>
          <Text style={styles.controlIcon}>⏭</Text>
        </Pressable>
      </View>

      {/* Secondary controls */}
      <View style={styles.secondaryControls}>
        <Pressable onPress={toggleShuffle} hitSlop={10}>
          <Text
            style={[
              styles.secondaryIcon,
              isShuffle && styles.secondaryIconActive,
            ]}
          >
            ⇄
          </Text>
        </Pressable>
        <Pressable onPress={cycleRepeat} hitSlop={10}>
          <Text
            style={[
              styles.secondaryIcon,
              repeatActive && styles.secondaryIconActive,
            ]}
          >
            {repeatIcon}
          </Text>
        </Pressable>
        <Pressable onPress={handleQueuePress} hitSlop={10}>
          <Text style={styles.secondaryIcon}>☰</Text>
        </Pressable>
      </View>

      <View style={{ paddingBottom: insets.bottom + Spacing.md }} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  headerChevron: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontWeight: Typography.bold,
  },
  headerTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerMore: {
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  artworkWrapper: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  artwork: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  infoText: {
    flex: 1,
    gap: 4,
  },
  trackTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  trackArtist: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  starIcon: {
    fontSize: 24,
    color: Colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxxl,
    paddingVertical: Spacing.xl,
  },
  controlIcon: {
    fontSize: 36,
    color: Colors.controlActive,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 28,
    color: '#000000',
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.md,
  },
  secondaryIcon: {
    fontSize: 22,
    color: Colors.controlInactive,
  },
  secondaryIconActive: {
    color: Colors.accent,
  },
});
