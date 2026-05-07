import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'AlbumDetail'>;

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
    >
      <View style={styles.hero}>
        <ArtworkImage uri={artwork} size={220} radius={Radius.lg} />
        <View style={styles.heroInfo}>
          <Text style={styles.title}>{albumTitle}</Text>
          <Text style={styles.artist}>{albumArtist}</Text>
          <View style={styles.metaRow}>
            {genre ? <Text style={styles.meta}>{genre}</Text> : null}
            {year ? <Text style={styles.meta}>· {year}</Text> : null}
            {hasLossless && (
              <View style={styles.losslessBadge}>
                <Text style={styles.losslessText}>Lossless</Text>
              </View>
            )}
          </View>
        </View>
      </View>

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

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        tracks.map((t, i) => (
          <TrackRow
            key={t.id}
            track={t}
            onPress={handleTrack}
            showArtwork={false}
            isActive={t.id === currentTrack?.id}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
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
});
