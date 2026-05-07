import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArtworkImage } from '@/components/ArtworkImage';
import { TrackRow } from '@/components/TrackRow';
import { usePlayerStore } from '@/store/playerStore';
import { getAlbumTracks } from '@/db/library';
import type { Track } from '@/db/library';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { shuffleTracks } from '@/audio/AudioEngine';
import { formatDuration } from '@/utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'AlbumDetail'>;

// ── List item types for heterogeneous FlashList ─────────────────────────────

type HeaderItem = { type: 'header'; disc: number };
type TrackItem  = { type: 'track';  track: Track };
type ListItem   = HeaderItem | TrackItem;

// ── AlbumTrackRow ────────────────────────────────────────────────────────────

type AlbumTrackRowProps = {
  track: Track;
  isActive: boolean;
  onPress: (t: Track) => void;
};

const AlbumTrackRow = React.memo(function AlbumTrackRow({
  track,
  isActive,
  onPress,
}: AlbumTrackRowProps) {
  const handlePress = useCallback(() => onPress(track), [onPress, track]);

  const subtitle = track.composer
    ? track.composer
    : track.artist;

  return (
    <Pressable
      style={({ pressed }) => [styles.trackRow, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <Text style={[styles.trackNum, isActive && styles.trackNumActive]}>
        {track.trackNum ?? '–'}
      </Text>
      <View style={styles.trackInfo}>
        <Text
          style={[styles.trackTitle, isActive && styles.trackTitleActive]}
          numberOfLines={2}
        >
          {track.title}
        </Text>
        {subtitle ? (
          <Text style={styles.trackSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable style={styles.moreBtn} hitSlop={10}>
        <Text style={styles.moreIcon}>···</Text>
      </Pressable>
    </Pressable>
  );
});

// ── DiscHeader ───────────────────────────────────────────────────────────────

function DiscHeader({ disc }: { disc: number }) {
  return (
    <View style={styles.discHeader}>
      <Text style={styles.discHeaderText}>Disco {disc}</Text>
    </View>
  );
}

// ── AlbumDetailScreen ────────────────────────────────────────────────────────

export function AlbumDetailScreen({ route, navigation }: Props) {
  const { albumTitle, albumArtist } = route.params;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const play = usePlayerStore((s) => s.play);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getAlbumTracks(albumTitle).then((t) => {
      setTracks(t);
      setLoading(false);
    });
  }, [albumTitle]);

  const artwork = tracks[0]?.artworkUri ?? null;
  const year = tracks[0]?.year;
  const genre = tracks[0]?.genre;
  const hasLossless = tracks.some((t) => t.isLossless);

  // Disc grouping
  const discGroups = useMemo(() => {
    const map = new Map<number, Track[]>();
    for (const t of tracks) {
      const disc = t.discNum ?? 1;
      const group = map.get(disc);
      if (group) {
        group.push(t);
      } else {
        map.set(disc, [t]);
      }
    }
    return map;
  }, [tracks]);

  const isMultiDisc = discGroups.size > 1;

  const discCount = useMemo(() => {
    if (tracks.length === 0) return null;
    const fromTag = tracks[0]?.totalDiscs;
    if (fromTag) return fromTag;
    return isMultiDisc ? discGroups.size : null;
  }, [tracks, isMultiDisc, discGroups]);

  // Flat list for FlashList with heterogeneous items
  const listData = useMemo<ListItem[]>(() => {
    if (!isMultiDisc) return [];
    const items: ListItem[] = [];
    const sortedDiscs = Array.from(discGroups.keys()).sort((a, b) => a - b);
    for (const disc of sortedDiscs) {
      items.push({ type: 'header', disc });
      for (const t of discGroups.get(disc) ?? []) {
        items.push({ type: 'track', track: t });
      }
    }
    return items;
  }, [isMultiDisc, discGroups]);

  const handlePlay = useCallback(() => play(tracks, 0), [play, tracks]);
  const handleShuffle = useCallback(() => {
    const shuffled = shuffleTracks(tracks);
    play(shuffled, 0);
  }, [play, tracks]);

  const handleTrack = useCallback(
    (t: Track) => {
      const idx = tracks.indexOf(t);
      play(tracks, idx >= 0 ? idx : 0);
    },
    [play, tracks],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return <DiscHeader disc={item.disc} />;
      }
      return (
        <AlbumTrackRow
          track={item.track}
          isActive={item.track.id === currentTrack?.id}
          onPress={handleTrack}
        />
      );
    },
    [currentTrack?.id, handleTrack],
  );

  const getItemType = useCallback(
    (item: ListItem) => item.type,
    [],
  );

  const hero = (
    <View style={styles.hero}>
      <ArtworkImage uri={artwork} size={220} radius={Radius.lg} />
      <View style={styles.heroInfo}>
        <Text style={styles.title}>{albumTitle}</Text>
        <Text style={styles.artist}>{albumArtist}</Text>
        <View style={styles.metaRow}>
          {genre ? <Text style={styles.meta}>{genre}</Text> : null}
          {year ? <Text style={styles.meta}>· {year}</Text> : null}
          {discCount ? (
            <Text style={styles.meta}>· {discCount} discos</Text>
          ) : null}
          <Text style={styles.meta}>· {tracks.length} pistas</Text>
          {hasLossless && (
            <View style={styles.losslessBadge}>
              <Text style={styles.losslessText}>Lossless</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const actions = (
    <View style={styles.actions}>
      <Pressable style={styles.actionBtn} onPress={handlePlay}>
        <Text style={styles.actionBtnText}>▶  Reproducir</Text>
      </Pressable>
      <Pressable
        style={[styles.actionBtn, styles.actionBtnOutline]}
        onPress={handleShuffle}
      >
        <Text style={[styles.actionBtnText, styles.actionBtnOutlineText]}>
          ⇄  Aleatorio
        </Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        {hero}
        {actions}
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  // Multi-disc: use FlashList with header/track items
  if (isMultiDisc) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + 80 }]}>
        <FlashList
          data={listData}
          renderItem={renderItem}
          getItemType={getItemType}
          estimatedItemSize={56}
          keyExtractor={(item, index) =>
            item.type === 'header'
              ? `disc-${item.disc}`
              : item.track.id
          }
          ListHeaderComponent={
            <>
              {hero}
              {actions}
            </>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        />
      </View>
    );
  }

  // Single disc: original layout with TrackRow
  return (
    <View style={styles.container}>
      <FlashList
        data={tracks}
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            onPress={handleTrack}
            showArtwork={false}
            showTrackNum
            isActive={item.id === currentTrack?.id}
          />
        )}
        estimatedItemSize={56}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          <>
            {hero}
            {actions}
          </>
        }
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
  centered: {
    alignItems: 'stretch',
  },
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.base,
    gap: Spacing.lg,
  },
  heroInfo: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  artist: {
    fontSize: Typography.md,
    fontWeight: Typography.medium,
    color: Colors.accent,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  meta: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  losslessBadge: {
    backgroundColor: Colors.losslessBg,
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  losslessText: {
    fontSize: 10,
    fontWeight: Typography.semibold,
    color: Colors.losslessText,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  actionBtnOutline: {
    backgroundColor: Colors.bgSurface,
  },
  actionBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  actionBtnOutlineText: {
    color: Colors.accent,
  },

  // Disc header
  discHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  discHeaderText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },

  // Album track row
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    minHeight: 52,
  },
  pressed: {
    opacity: 0.6,
  },
  trackNum: {
    width: 28,
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'right',
    flexShrink: 0,
  },
  trackNumActive: {
    color: Colors.accent,
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  trackTitleActive: {
    color: Colors.accent,
  },
  trackSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  moreBtn: {
    paddingHorizontal: Spacing.xs,
    flexShrink: 0,
  },
  moreIcon: {
    fontSize: 18,
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
});
