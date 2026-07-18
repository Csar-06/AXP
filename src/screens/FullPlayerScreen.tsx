import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  StatusBar,
  Modal,
  Animated,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArtworkImage } from '@/components/ArtworkImage';
import { CreatePlaylistModal } from '@/components/CreatePlaylistModal';
import { LyricsView } from '@/components/LyricsView';
import { MarqueeText } from '@/components/MarqueeText';
import { ProgressBar } from '@/components/ProgressBar';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useThemeStore } from '@/store/themeStore';
import { RepeatMode } from '@/audio/TrackPlayerSetup';
import { getLyricsForTrack } from '@/audio/lyrics';
import { addTrackToPlaylist } from '@/db/library';
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

  const isFavorite = useLibraryStore((s) => !!s.favoriteTrackIds[currentTrack?.id ?? '']);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const playlists = useLibraryStore((s) => s.playlists);
  const refreshPlaylists = useLibraryStore((s) => s.refreshPlaylists);

  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [trackMenuVisible, setTrackMenuVisible] = useState(false);
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
  const [createPlaylistVisible, setCreatePlaylistVisible] = useState(false);

  const lightAssetSource = '/home/ibune/Projects/AXP/AXP/assets/light/'

  const scale = useRef(new Animated.Value(isPlaying ? 1 : 0.786)).current;
  const starScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isPlaying ? 1 : 0.786,
      useNativeDriver: false,
      stiffness: 200,
      damping: 18,
    }).start();
  }, [isPlaying, scale]);

  useEffect(() => {
    starScale.setValue(1);
  }, [currentTrack?.id, starScale]);

  const runLikeStarAnim = useCallback(() => {
    Animated.sequence([
      Animated.spring(starScale, {
        toValue: 1.2,
        useNativeDriver: true,
        stiffness: 200,
        damping: 18,
      }),
      Animated.spring(starScale, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 200,
        damping: 18,
      }),
    ]).start();
  }, [starScale]);

  const runUnlikeStarAnim = useCallback(() => {
    Animated.sequence([
      Animated.spring(starScale, {
        toValue: 0.92,
        useNativeDriver: true,
        stiffness: 200,
        damping: 20,
      }),
      Animated.spring(starScale, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 200,
        damping: 18,
      }),
    ]).start();
  }, [starScale]);

  const handleFavoritePress = useCallback(() => {
    if (!currentTrack) return;
    const willFavorite = !isFavorite;
    if (willFavorite) {
      runLikeStarAnim();
    } else {
      runUnlikeStarAnim();
    }
    toggleFavorite(currentTrack.id);
  }, [
    currentTrack,
    isFavorite,
    runLikeStarAnim,
    runUnlikeStarAnim,
    toggleFavorite,
  ]);

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

  // Lyrics (.lrc sidecar preferred, else embedded) are cached on the track at
  // scan time, so this is a plain lookup — it enables the lyrics button and
  // feeds the karaoke overlay.
  const lyricsRaw = useMemo(
    () => (currentTrack ? getLyricsForTrack(currentTrack) : null),
    [currentTrack],
  );

  const handleLyricsOpen = useCallback(() => setLyricsVisible(true), []);
  const handleLyricsClose = useCallback(() => setLyricsVisible(false), []);

  const openTrackMenu = useCallback(() => setTrackMenuVisible(true), []);
  const closeTrackMenu = useCallback(() => setTrackMenuVisible(false), []);

  const handleChooseAddToPlaylist = useCallback(() => {
    setTrackMenuVisible(false);
    setPlaylistPickerVisible(true);
  }, []);

  const handleGoToAlbum = useCallback(() => {
    if (!currentTrack) return;
    setTrackMenuVisible(false);
    navigation.navigate('AlbumDetail', {
      albumTitle: currentTrack.album,
      albumArtist: currentTrack.albumArtist,
    });
  }, [currentTrack, navigation]);

  const handleSelectPlaylist = useCallback(
    async (playlistId: string) => {
      if (!currentTrack) return;
      await addTrackToPlaylist(playlistId, currentTrack.id);
      await refreshPlaylists();
      setPlaylistPickerVisible(false);
    },
    [currentTrack, refreshPlaylists],
  );

  const handlePlaylistCreatedFromPlayer = useCallback(
    async (playlistId: string) => {
      if (!currentTrack) return;
      await addTrackToPlaylist(playlistId, currentTrack.id);
      await refreshPlaylists();
      setPlaylistPickerVisible(false);
    },
    [currentTrack, refreshPlaylists],
  );

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

  const playlistPickerData = useMemo(
    () => [
      { kind: 'new' as const },
      ...playlists.map((p) => ({ kind: 'playlist' as const, playlist: p })),
    ],
    [playlists],
  );

  if (!currentTrack) return null;

  const hasLyrics = Boolean(lyricsRaw?.trim());

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
          <Pressable onPress={handleFavoritePress} hitSlop={10}>
            <Animated.View style={{ transform: [{ scale: starScale }] }}>
              <Text
                style={
                  isFavorite ? styles.starIconLiked : styles.starIconUnliked
                }
              >
                {isFavorite ? '✦' : '✧'}
              </Text>
            </Animated.View>
          </Pressable>
          <Pressable onPress={openTrackMenu} hitSlop={13}>
            <Text style={styles.moreOptions}>···</Text>
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
              <ArtworkImage
                uri={currentTrack.artworkUri}
                size={68}
                radius={Radius.md}
              />
              <View style={styles.lyricsHeaderInfo}>
                <MarqueeText text={currentTrack.title} style={styles.lyricsSong} />
                <MarqueeText
                  text={currentTrack.artist}
                  style={styles.lyricsArtist}
                />
              </View>
              <Pressable onPress={handleFavoritePress} hitSlop={10}>
                <Text
                  style={
                    isFavorite ? styles.starIconLiked : styles.starIconUnliked
                  }
                >
                  {isFavorite ? '✦' : '✧'}
                </Text>
              </Pressable>
              <Pressable onPress={handleLyricsClose} hitSlop={12}>
                <Text style={styles.lyricsClose}>✕</Text>
              </Pressable>
            </View>
            {lyricsRaw ? (
              <LyricsView
                raw={lyricsRaw}
                position={position}
                onSeekTo={seek}
                bottomInset={insets.bottom}
              />
            ) : null}
          </LinearGradient>
        </Modal>

        <Modal
          visible={trackMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={closeTrackMenu}
        >
          <View style={styles.trackMenuRoot}>
            <Pressable
              style={styles.trackMenuBackdrop}
              onPress={closeTrackMenu}
            />
            <View
              style={[
                styles.trackMenuSheet,
                { paddingBottom: insets.bottom + Spacing.md },
              ]}
            >
              <Pressable
                style={styles.trackMenuRow}
                onPress={handleChooseAddToPlaylist}
              >
                <Text style={styles.trackMenuRowLabel}>Agregar a playlist</Text>
              </Pressable>
              <Pressable style={styles.trackMenuRow} onPress={handleGoToAlbum}>
                <Text style={styles.trackMenuRowLabel}>Ir al álbum</Text>
              </Pressable>
              <Pressable style={styles.trackMenuRowLast} onPress={closeTrackMenu}>
                <Text style={styles.trackMenuCancel}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={playlistPickerVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setPlaylistPickerVisible(false)}
        >
          <View style={[styles.playlistPickerRoot, { paddingTop: insets.top }]}>
            <View style={styles.playlistPickerHeader}>
              <Text style={styles.playlistPickerTitle}>Agregar a lista</Text>
              <Pressable
                onPress={() => setPlaylistPickerVisible(false)}
                hitSlop={12}
              >
                <Text style={styles.lyricsClose}>✕</Text>
              </Pressable>
            </View>
            <FlatList
              data={playlistPickerData}
              keyExtractor={(item) =>
                item.kind === 'new' ? '__new__' : item.playlist.id
              }
              style={styles.playlistPickerList}
              contentContainerStyle={{
                paddingBottom: insets.bottom + Spacing.xl,
              }}
              renderItem={({ item }) =>
                item.kind === 'new' ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.playlistPickerRow,
                      pressed && styles.playlistPickerRowPressed,
                    ]}
                    onPress={() => setCreatePlaylistVisible(true)}
                  >
                    <Text style={styles.playlistPickerNewLabel}>
                      + Nueva playlist
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.playlistPickerRow,
                      pressed && styles.playlistPickerRowPressed,
                    ]}
                    onPress={() => handleSelectPlaylist(item.playlist.id)}
                  >
                    <ArtworkImage
                      uri={item.playlist.artworkUri}
                      size={44}
                      radius={Radius.sm}
                    />
                    <Text style={styles.playlistPickerName} numberOfLines={1}>
                      {item.playlist.name}
                    </Text>
                  </Pressable>
                )
              }
            />
          </View>
        </Modal>

        <CreatePlaylistModal
          visible={createPlaylistVisible}
          onClose={() => setCreatePlaylistVisible(false)}
          onCreated={handlePlaylistCreatedFromPlayer}
        />
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
  moreOptions: {
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
  starIconLiked: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: Typography.bold,
  },
  starIconUnliked: {
    fontSize: 24,
    color: Colors.textTertiary,
    fontWeight: Typography.bold,
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.base,
  },
  lyricsHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  lyricsSong: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  lyricsArtist: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
  },
  lyricsClose: {
    fontSize: 20,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },
  trackMenuRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  trackMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  trackMenuSheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.sm,
  },
  trackMenuRow: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  trackMenuRowLast: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
  },
  trackMenuRowLabel: {
    fontSize: Typography.md,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  trackMenuCancel: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.accent,
    textAlign: 'center',
  },
  playlistPickerRoot: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  playlistPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  playlistPickerTitle: {
    flex: 1,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  playlistPickerList: {
    flex: 1,
  },
  playlistPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  playlistPickerRowPressed: { opacity: 0.65 },
  playlistPickerNewLabel: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.accent,
  },
  playlistPickerName: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
});
