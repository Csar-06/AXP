import React, { useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  deletePlaylist,
  getPlaylistTracks,
} from '@/db/library';
import type { Playlist } from '@/db/library';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { Colors, Spacing, Typography, Radius } from '@/theme';

export type PlaylistSortMode = 'playlist' | 'title' | 'artist' | 'album';

type Props = {
  visible: boolean;
  onClose: () => void;
  playlist: Playlist | null;
  onRequestEdit: (playlist: Playlist) => void;
  /** After delete (e.g. navigate back from detail). */
  onDeleted?: () => void;
  showSortOptions?: boolean;
  sortMode?: PlaylistSortMode;
  onSortChange?: (mode: PlaylistSortMode) => void;
};

export function PlaylistActionSheet({
  visible,
  onClose,
  playlist,
  onRequestEdit,
  onDeleted,
  showSortOptions,
  sortMode,
  onSortChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const play = usePlayerStore((s) => s.play);
  const appendTracksToQueue = usePlayerStore((s) => s.appendTracksToQueue);
  const insertTracksAfterCurrent = usePlayerStore(
    (s) => s.insertTracksAfterCurrent,
  );
  const refreshPlaylists = useLibraryStore((s) => s.refreshPlaylists);

  const loadTracks = useCallback(async () => {
    if (!playlist) return [];
    return getPlaylistTracks(playlist.id);
  }, [playlist]);

  const handlePlay = useCallback(async () => {
    if (!playlist) return;
    onClose();
    const tracks = await loadTracks();
    if (tracks.length === 0) return;
    await play(tracks, 0);
  }, [playlist, play, loadTracks, onClose]);

  const handleEdit = useCallback(() => {
    if (!playlist) return;
    onClose();
    onRequestEdit(playlist);
  }, [playlist, onRequestEdit, onClose]);

  const handleDelete = useCallback(() => {
    if (!playlist) return;
    if (playlist.name === 'Favoritos') {
      Alert.alert(
        'No disponible',
        'La lista «Favoritos» no se puede eliminar.',
      );
      return;
    }
    Alert.alert(
      'Eliminar lista',
      `¿Eliminar «${playlist.name}»? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlaylist(playlist.id);
              await refreshPlaylists();
              onClose();
              onDeleted?.();
            } catch (e) {
              console.warn('[PlaylistActionSheet] delete', e);
            }
          },
        },
      ],
    );
  }, [playlist, refreshPlaylists, onClose, onDeleted]);

  const handlePlayNext = useCallback(async () => {
    if (!playlist) return;
    const tracks = await loadTracks();
    if (tracks.length === 0) return;
    onClose();
    await insertTracksAfterCurrent(tracks);
  }, [playlist, loadTracks, insertTracksAfterCurrent, onClose]);

  const handleAppendQueue = useCallback(async () => {
    if (!playlist) return;
    const tracks = await loadTracks();
    if (tracks.length === 0) return;
    onClose();
    await appendTracksToQueue(tracks);
  }, [playlist, loadTracks, appendTracksToQueue, onClose]);

  const handleSort = useCallback(
    (mode: PlaylistSortMode) => {
      onSortChange?.(mode);
      onClose();
    },
    [onSortChange, onClose],
  );

  if (!playlist) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + Spacing.md, maxHeight: '85%' },
          ]}
        >
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {playlist.name}
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.row} onPress={handlePlay}>
              <Text style={styles.rowLabel}>Reproducir</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={handleEdit}>
              <Text style={styles.rowLabel}>Editar playlist</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={handleDelete}>
              <Text style={styles.rowDestructive}>Eliminar playlist</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={handlePlayNext}>
              <Text style={styles.rowLabel}>Poner a continuación en la cola</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={handleAppendQueue}>
              <Text style={styles.rowLabel}>Agregar a la cola de reproducción</Text>
            </Pressable>

            {showSortOptions ? (
              <>
                <View style={styles.sectionDivider} />
                <Text style={styles.sectionTitle}>Ordenar por</Text>
                {(
                  [
                    ['playlist', 'Orden de playlist'],
                    ['title', 'Título'],
                    ['artist', 'Artista'],
                    ['album', 'Álbum'],
                  ] as const
                ).map(([mode, label]) => (
                  <Pressable
                    key={mode}
                    style={styles.row}
                    onPress={() => handleSort(mode)}
                  >
                    <Text
                      style={
                        sortMode === mode ? styles.rowLabelActive : styles.rowLabel
                      }
                    >
                      {label}
                      {sortMode === mode ? ' ✓' : ''}
                    </Text>
                  </Pressable>
                ))}
              </>
            ) : null}

            <Pressable style={styles.rowLast} onPress={onClose}>
              <Text style={styles.cancelLabel}>Cancelar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.md,
  },
  sheetTitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.base,
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.xs,
  },
  row: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  rowLast: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
  },
  rowLabel: {
    fontSize: Typography.md,
    color: Colors.textPrimary,
  },
  rowLabelActive: {
    fontSize: Typography.md,
    color: Colors.accent,
    fontWeight: Typography.medium,
  },
  rowDestructive: {
    fontSize: Typography.md,
    color: '#ff453a',
  },
  cancelLabel: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.accent,
    textAlign: 'center',
  },
});
