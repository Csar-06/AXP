import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  StatusBar,
  ScrollView,
  Modal,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

  const [lyricsVisible, setLyricsVisible] = useState(false);

  const lightAssetSource = '/home/ibune/Projects/AXP/AXP/assets/light/'

  const scale = useRef(new Animated.Value(isPlaying ? 1 : 0.786)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isPlaying ? 1 : 0.786,
      useNativeDriver: false,
      stiffness: 200,
      damping: 18,
    }).start();
  }, [isPlaying])

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

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleLyricsOpen = useCallback(() => setLyricsVisible(true), []);
  const handleLyricsClose = useCallback(() => setLyricsVisible(false), []);

  useEffect(() => {
    return () => {
      usePlayerStore.getState().setPlayerVisible(false);
    };
  }, []);

  const dismissGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(15)
        .failOffsetY(-15)
        .runOnJS(true)
        .onEnd((event) => {
          if (event.translationY > 80 || event.velocityY > 600) {
            handleClose();
          }
        }),
    [handleClose],
  );

  if (!currentTrack) return null;

  const hasLyrics = Boolean(currentTrack.lyrics?.trim());

  return (
    <GestureDetector gesture={dismissGesture}>
      <LinearGradient
        colors={[playerBg, playerBgSecondary, '#000000']}
        locations={[0, 0.5, 1]}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reproduciendo</Text>
        </View>

        {/* Album art */}
        <View style={styles.artworkWrapper}>
          <Animated.View style={[styles.artwork, { transform: [{ scale }] }]} >
            <ArtworkImage
              uri={currentTrack.artworkUri}
              size={350}
              radius={Radius.lg}
            />
          </Animated.View>

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
          <Pressable hitSlop={13}>
            <Text style={styles.headerMore}>···</Text>
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
            <Image
              style={styles.controlIcon}
              source={require(`${lightAssetSource}light-back-icon.png`)}
            />
          </Pressable>
          <Pressable
            onPress={togglePlayPause}
            style={styles.playBtn}
            hitSlop={4}
          >
            {isPlaying ?
              <Image
                style={styles.controlIcon}
                source={require(`${lightAssetSource}light-pause-icon.png`)}
              />
              :
              <Image
                style={styles.controlIcon}
                source={require(`${lightAssetSource}light-play-icon.png`)}
              />}

          </Pressable>
          <Pressable onPress={next} hitSlop={10}>
            <Image
              style={styles.controlIcon}
              source={require(`${lightAssetSource}light-forward-icon.png`)}
            />
          </Pressable>
        </View>

        {/* Secondary controls */}
        <View style={styles.secondaryControls}>
          <Pressable
            onPress={hasLyrics ? handleLyricsOpen : undefined}
            hitSlop={10}
          >
            <Image
              style={[
                styles.secondaryIcon,
                hasLyrics ?
                  { tintColor: Colors.textSecondary }
                  :
                  { tintColor: Colors.textTertiary }]}
              source={require(`${lightAssetSource}light-lyrics-icon.png`)}
            />

          </Pressable>
          <Pressable onPress={handleQueuePress} hitSlop={10}>
            {/* <Text style={styles.secondaryIcon}>☰</Text> */}
            <Image

              style={[styles.secondaryIcon, { tintColor: Colors.textSecondary }]}
              source={require(`${lightAssetSource}light-queque-icon.png`)}
            />
          </Pressable>
        </View>

        <View style={{ paddingBottom: insets.bottom + Spacing.md }} />

        {/* Lyrics overlay */}
        <Modal
          visible={lyricsVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleLyricsClose}
        >
          <LinearGradient
            colors={[playerBg, playerBgSecondary, '#000000']}
            locations={[0, 0.4, 1]}
            style={[styles.lyricsModal, { paddingTop: insets.top }]}
          >
            <View style={styles.lyricsHeader}>
              <View style={styles.lyricsHeaderInfo}>
                <Text style={styles.lyricsSong} numberOfLines={1}>
                  {currentTrack.title}
                </Text>
                <Text style={styles.lyricsArtist} numberOfLines={1}>
                  {currentTrack.artist}
                </Text>
              </View>
              <Pressable onPress={handleLyricsClose} hitSlop={12}>
                <Text style={styles.lyricsClose}>✕</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.lyricsScroll}
              contentContainerStyle={[
                styles.lyricsContent,
                { paddingBottom: insets.bottom + Spacing.xxxl },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.lyricsText}>{currentTrack.lyrics}</Text>
            </ScrollView>
          </LinearGradient>
        </Modal>
      </LinearGradient>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: Colors.textSecondary,
  },
  artworkWrapper: {
    flex: .85,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,

  },
  artwork: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 24,

  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
    gap: Spacing.xl,
  },
  infoText: {
    flex: 1,
    gap: 2,
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
  trackComposer: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
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
    paddingVertical: Spacing.xxl,
  },
  controlIcon: {
    width: 52,
    height: 52
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.xs,
  },
  secondaryIcon: {
    fontSize: 22,
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  secondaryIconActive: {
    color: Colors.accent,
  },
  secondaryIconAvailable: {
    color: Colors.controlInactive,
  },
  secondaryIconDisabled: {
    color: Colors.textTertiary,
    opacity: 0.4,
  },

  // Lyrics modal
  lyricsModal: {
    flex: 1,
  },
  lyricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  lyricsHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  lyricsSong: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  lyricsArtist: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  lyricsClose: {
    fontSize: 18,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  lyricsText: {
    fontSize: Typography.base,
    lineHeight: 28,
    color: Colors.textPrimary,
  },
});
