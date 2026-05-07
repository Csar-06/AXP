import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchBar } from '@/components/SearchBar';
import { TrackRow } from '@/components/TrackRow';
import { ListHeader } from '@/components/ListHeader';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { Colors } from '@/theme';
import type { Track } from '@/db/library';

export function PistasScreen() {
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const tracks = useLibraryStore((s) => s.tracks);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const play = usePlayerStore((s) => s.play);
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q),
        )
      : [...tracks];
    list.sort((a, b) =>
      sortAsc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title),
    );
    return list;
  }, [tracks, search, sortAsc]);

  const handlePress = useCallback(
    (track: Track) => {
      const idx = filtered.indexOf(track);
      play(filtered, idx >= 0 ? idx : 0);
    },
    [filtered, play],
  );

  const renderItem = useCallback(
    ({ item }: { item: Track }) => (
      <TrackRow
        track={item}
        onPress={handlePress}
        isActive={item.id === currentTrack?.id}
      />
    ),
    [handlePress, currentTrack?.id],
  );

  return (
    <View style={styles.container}>
      <SearchBar value={search} onChangeText={setSearch} />
      <ListHeader
        count={filtered.length}
        label="pistas"
        sortLabel={sortAsc ? 'A → Z' : 'Z → A'}
        onSortPress={() => setSortAsc((v) => !v)}
      />
      <FlashList
        data={filtered}
        renderItem={renderItem}
        estimatedItemSize={60}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
});
