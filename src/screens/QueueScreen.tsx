import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SectionList,
  SectionListData,
  SectionListRenderItemInfo,
  RefreshControl,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArtworkImage } from '@/components/ArtworkImage';
import { usePlayerStore } from '@/store/playerStore';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Track } from '@/db/library';
import type { RootStackParamList } from '@/navigation/types';
import TrackPlayer from 'react-native-track-player';
import { RepeatMode } from '@/audio/TrackPlayerSetup';

type Props = NativeStackScreenProps<RootStackParamList, 'QueueView'>;

type Section = {
  key: 'history' | 'upcoming';
  title: string;
  data: Track[];
};

const DESTRUCTIVE = '#ff453a';

export function QueueScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearUpcoming = usePlayerStore((s) => s.clearUpcoming);

  const [showHistory, setShowHistory] = useState(false);
  const openSwipeableRef = useRef<Swipeable | null>(null);

  const repeatIcon =
    repeatMode === RepeatMode.Off ? '↻' : repeatMode === RepeatMode.Queue ? '↻' : '①';

  const currentTrackIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return queue.findIndex((t) => t.id === currentTrack.id);
  }, [queue, currentTrack]);

  const { history, sections } = useMemo(() => {
    const safeIndex = currentTrackIndex >= 0 ? currentTrackIndex : 0;
    const hist = currentTrackIndex >= 0 ? queue.slice(0, safeIndex) : [];
    const up = currentTrackIndex >= 0 ? queue.slice(safeIndex + 1) : queue;

    const secs: Section[] = [];
    if (showHistory && hist.length > 0) {
      secs.push({ key: 'history', title: 'Historial', data: hist });
    }
    secs.push({ key: 'upcoming', title: 'Fila', data: up });

    return { history: hist, sections: secs };
  }, [queue, currentTrackIndex, showHistory]);

  const handleSkipToTrack = useCallback(
    async (_track: Track, upcomingIndex: number) => {
      if (currentTrackIndex < 0) return;
      const absoluteIndex = currentTrackIndex + 1 + upcomingIndex;
      try {
        await TrackPlayer.skip(absoluteIndex);
        await TrackPlayer.play();
      } catch (e) {
        console.warn('[QueueScreen] skip failed:', e);
      }
    },
    [currentTrackIndex],
  );

  const handleSkipToHistory = useCallback(async (historyIndex: number) => {
    try {
      await TrackPlayer.skip(historyIndex);
      await TrackPlayer.play();
    } catch (e) {
      console.warn('[QueueScreen] skip to history failed:', e);
    }
  }, []);

  const handleRemoveUpcoming = useCallback(
    async (upcomingIndex: number, swipeable: Swipeable | null) => {
      if (currentTrackIndex < 0) return;
      const absoluteIndex = currentTrackIndex + 1 + upcomingIndex;
      swipeable?.close();
      if (openSwipeableRef.current === swipeable) {
        openSwipeableRef.current = null;
      }
      await removeFromQueue(absoluteIndex);
    },
    [currentTrackIndex, removeFromQueue],
  );

  const handleClearUpcoming = useCallback(async () => {
    await clearUpcoming();
  }, [clearUpcoming]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Track, Section> }) => {
      if (section.key === 'upcoming') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fila</Text>
            <Pressable onPress={handleClearUpcoming} hitSlop={8}>
              <Text style={styles.clearBtn}>Borrar</Text>
            </Pressable>
          </View>
        );
      }
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Historial</Text>
        </View>
      );
    },
    [handleClearUpcoming],
  );

  const renderRightActions = useCallback(
    (
      _progress: Animated.AnimatedInterpolation<number>,
      _drag: Animated.AnimatedInterpolation<number>,
      upcomingIndex: number,
      swipeableRef: React.MutableRefObject<Swipeable | null>,
    ) => {
      return (
        <View style={styles.deleteActionContainer}>
          <Pressable
            style={styles.deleteAction}
            onPress={() => handleRemoveUpcoming(upcomingIndex, swipeableRef.current)}
          >
            <Text style={styles.deleteActionIcon}>−</Text>
          </Pressable>
        </View>
      );
    },
    [handleRemoveUpcoming],
  );

  const renderItem = useCallback(
    ({ item, index, section }: SectionListRenderItemInfo<Track, Section>) => {
      if (section.key === 'history') {
        return (
          <Pressable
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => handleSkipToHistory(index)}
          >
            <ArtworkImage uri={item.artworkUri} size={44} radius={Radius.sm} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.itemArtist} numberOfLines={1}>
                {item.artist}
              </Text>
            </View>
          </Pressable>
        );
      }

      return (
        <SwipeableRow
          onOpen={(ref) => {
            if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
              openSwipeableRef.current.close();
            }
            openSwipeableRef.current = ref;
          }}
          renderRightActions={(progress, drag, ref) =>
            renderRightActions(progress, drag, index, ref)
          }
        >
          <Pressable
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => handleSkipToTrack(item, index)}
          >
            <ArtworkImage uri={item.artworkUri} size={44} radius={Radius.sm} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.itemArtist} numberOfLines={1}>
                {item.artist}
              </Text>
            </View>
            <Text style={styles.dragHandle}>≡</Text>
          </Pressable>
        </SwipeableRow>
      );
    },
    [handleSkipToTrack, handleSkipToHistory, renderRightActions],
  );

  return (
    <View style={styles.container}>
      {/* Current track header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        {currentTrack && (
          <View style={styles.nowPlaying}>
            <ArtworkImage
              uri={currentTrack.artworkUri}
              size={44}
              radius={Radius.sm}
            />
            <View style={styles.nowPlayingInfo}>
              <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
          </View>
        )}
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backChevron}>⌄</Text>
        </Pressable>
      </View>

      {/* Playback mode toggles */}
      <View style={styles.modes}>
        <Pressable
          style={[styles.modeBtn, isShuffle && styles.modeBtnActive]}
          onPress={toggleShuffle}
        >
          <Text style={[styles.modeBtnText, isShuffle && styles.modeBtnTextActive]}>
            ⇄
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.modeBtn,
            repeatMode !== RepeatMode.Off && styles.modeBtnActive,
          ]}
          onPress={cycleRepeat}
        >
          <Text
            style={[
              styles.modeBtnText,
              repeatMode !== RepeatMode.Off && styles.modeBtnTextActive,
            ]}
          >
            {repeatIcon}
          </Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(t, idx) => `${t.id}-${idx}`}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={
          !showHistory && history.length > 0 ? (
            <RefreshControl
              refreshing={false}
              onRefresh={() => setShowHistory(true)}
              tintColor={Colors.textSecondary}
              colors={[Colors.accent]}
            />
          ) : undefined
        }
      />
    </View>
  );
}

type SwipeableRowProps = {
  children: React.ReactNode;
  onOpen: (ref: Swipeable) => void;
  renderRightActions: (
    progress: Animated.AnimatedInterpolation<number>,
    drag: Animated.AnimatedInterpolation<number>,
    ref: React.MutableRefObject<Swipeable | null>,
  ) => React.ReactNode;
};

function SwipeableRow({ children, onOpen, renderRightActions }: SwipeableRowProps) {
  const ref = useRef<Swipeable | null>(null);
  return (
    <Swipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableOpen={() => {
        if (ref.current) onOpen(ref.current);
      }}
      renderRightActions={(progress, drag) =>
        renderRightActions(progress, drag, ref)
      }
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  backChevron: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontWeight: Typography.bold,
    paddingHorizontal: Spacing.sm,
  },
  nowPlaying: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  nowPlayingInfo: { flex: 1 },
  nowPlayingTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  nowPlayingArtist: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  modes: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: Colors.accentMuted,
  },
  modeBtnText: {
    fontSize: 20,
    color: Colors.controlInactive,
  },
  modeBtnTextActive: {
    color: Colors.accent,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  clearBtn: {
    fontSize: Typography.sm,
    color: Colors.accent,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    backgroundColor: Colors.bg,
  },
  itemPressed: {
    backgroundColor: Colors.bgElevated,
  },
  itemInfo: { flex: 1 },
  itemTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  itemArtist: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  dragHandle: {
    fontSize: 18,
    color: Colors.textTertiary,
    paddingHorizontal: 4,
  },
  deleteActionContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: Spacing.base,
    paddingVertical: Spacing.xs,
  },
  deleteAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DESTRUCTIVE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionIcon: {
    fontSize: 28,
    lineHeight: 30,
    color: '#ffffff',
    fontWeight: Typography.bold,
  },
});
