import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArtworkImage } from '@/components/ArtworkImage';
import { usePlayerStore } from '@/store/playerStore';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Track } from '@/db/library';
import type { RootStackParamList } from '@/navigation/types';
import TrackPlayer from 'react-native-track-player';
import { RepeatMode } from '@/audio/TrackPlayerSetup';

type Props = NativeStackScreenProps<RootStackParamList, 'QueueView'>;

export function QueueScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);

  const repeatIcon =
    repeatMode === RepeatMode.Off ? '↻' : repeatMode === RepeatMode.Queue ? '↻' : '①';

  const handleRemove = useCallback(async (index: number) => {
    await TrackPlayer.remove(index);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Track>) => {
      const isCurrentTrack = item.id === currentTrack?.id;
      return (
        <View style={styles.item}>
          <ArtworkImage uri={item.artworkUri} size={44} radius={Radius.sm} />
          <View style={styles.itemInfo}>
            <Text
              style={[styles.itemTitle, isCurrentTrack && styles.itemTitleActive]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={styles.itemArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>
          <Pressable onPress={() => handleRemove(index)} hitSlop={8}>
            <Text style={styles.removeIcon}>✕</Text>
          </Pressable>
        </View>
      );
    },
    [currentTrack?.id, handleRemove],
  );

  return (
    <View style={styles.container}>
      {/* Current track header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backChevron}>⌄</Text>
        </Pressable>
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

      {/* Queue list header */}
      <View style={styles.queueHeader}>
        <Text style={styles.queueLabel}>Fila</Text>
        <Pressable onPress={() => TrackPlayer.reset()} hitSlop={8}>
          <Text style={styles.clearBtn}>Borrar</Text>
        </Pressable>
      </View>

      <FlatList
        data={queue}
        renderItem={renderItem}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      />
    </View>
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
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  queueLabel: {
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
  },
  itemInfo: { flex: 1 },
  itemTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  itemTitleActive: { color: Colors.accent },
  itemArtist: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  removeIcon: {
    fontSize: 14,
    color: Colors.textTertiary,
    paddingHorizontal: 4,
  },
});
