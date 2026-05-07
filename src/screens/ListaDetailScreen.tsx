import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, FlatList, ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TrackRow } from '@/components/TrackRow';
import { usePlayerStore } from '@/store/playerStore';
import { getPlaylistTracks } from '@/db/library';
import type { Track } from '@/db/library';
import { Colors } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ListaDetail'>;

export function ListaDetailScreen({ route }: Props) {
  const { playlistId } = route.params;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const play = usePlayerStore((s) => s.play);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const insets = useSafeAreaInsets();

  const reload = useCallback(async () => {
    const t = await getPlaylistTracks(playlistId);
    setTracks(t);
    setLoading(false);
  }, [playlistId]);

  useEffect(() => { reload(); }, [reload]);

  const handlePress = useCallback(
    (t: Track) => {
      const idx = tracks.indexOf(t);
      play(tracks, idx >= 0 ? idx : 0);
    },
    [play, tracks],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Track>) => (
      <TrackRow
        track={item}
        onPress={handlePress}
        isActive={item.id === currentTrack?.id}
      />
    ),
    [handlePress, currentTrack?.id],
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tracks}
        renderItem={renderItem}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
});
