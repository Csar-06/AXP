import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TrackRow } from '@/components/TrackRow';
import { usePlayerStore } from '@/store/playerStore';
import { getGenreTracks } from '@/db/library';
import type { Track } from '@/db/library';
import { Colors, Spacing, Typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GeneroDetail'>;

export function GeneroDetailScreen({ route }: Props) {
  const { genreName } = route.params;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const play = usePlayerStore((s) => s.play);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getGenreTracks(genreName).then((t) => {
      setTracks(t);
      setLoading(false);
    });
  }, [genreName]);

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
      <View style={styles.header}>
        <Text style={styles.title}>{genreName}</Text>
        <Text style={styles.count}>{tracks.length} pistas</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        tracks.map((t) => (
          <TrackRow
            key={t.id}
            track={t}
            onPress={handleTrack}
            isActive={t.id === currentTrack?.id}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  count: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
