import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtworkImage } from '@/components/ArtworkImage';
import {
  createPlaylist,
  persistPlaylistCoverFromPick,
  updatePlaylist,
} from '@/db/library';
import type { Playlist } from '@/db/library';
import { useLibraryStore } from '@/store/libraryStore';
import { Colors, Spacing, Typography, Radius } from '@/theme';

const GALLERY_COLS = 3;
const GALLERY_GAP = 4;
const GALLERY_PAGE = 48;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called after the playlist row is persisted and playlists refreshed. */
  onCreated?: (playlistId: string) => void | Promise<void>;
  /** When set, modal edits this playlist instead of creating a new one. */
  editingPlaylist?: Playlist | null;
  onUpdated?: (playlistId: string) => void | Promise<void>;
};

export function CreatePlaylistModal({
  visible,
  onClose,
  onCreated,
  editingPlaylist,
  onUpdated,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const refreshPlaylists = useLibraryStore((s) => s.refreshPlaylists);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  /** Temporary URI from gallery (shown in preview; copied to cache on save). */
  const [pickedCoverUri, setPickedCoverUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryAssets, setGalleryAssets] = useState<MediaLibrary.Asset[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryCursor, setGalleryCursor] = useState<string | undefined>(
    undefined,
  );
  const [galleryHasNext, setGalleryHasNext] = useState(false);

  const gridPad = Spacing.base * 2;
  const thumbSize = Math.floor(
    (windowWidth - gridPad - GALLERY_GAP * (GALLERY_COLS - 1)) / GALLERY_COLS,
  );

  useEffect(() => {
    if (!visible) {
      setName('');
      setDescription('');
      setPickedCoverUri(null);
      setSaving(false);
      setGalleryVisible(false);
      setGalleryAssets([]);
      setGalleryCursor(undefined);
      setGalleryHasNext(false);
      return;
    }
    if (editingPlaylist) {
      setName(editingPlaylist.name);
      setDescription(editingPlaylist.description ?? '');
      setPickedCoverUri(editingPlaylist.artworkUri);
    } else {
      setName('');
      setDescription('');
      setPickedCoverUri(null);
    }
  }, [visible, editingPlaylist]);

  const fetchGalleryPage = useCallback(
    async (after?: string) => {
      const page = await MediaLibrary.getAssetsAsync({
        first: GALLERY_PAGE,
        after,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [
          [MediaLibrary.SortBy.creationTime, false],
        ],
      });
      return page;
    },
    [],
  );

  const openGallery = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso necesario',
        'Activa el acceso a la galería para elegir una portada.',
      );
      return;
    }
    setGalleryLoading(true);
    try {
      const page = await fetchGalleryPage();
      setGalleryAssets(page.assets);
      setGalleryCursor(page.endCursor);
      setGalleryHasNext(page.hasNextPage);
      setGalleryVisible(true);
    } finally {
      setGalleryLoading(false);
    }
  }, [fetchGalleryPage]);

  const loadMoreGallery = useCallback(async () => {
    if (!galleryHasNext || galleryLoading || !galleryCursor) return;
    setGalleryLoading(true);
    try {
      const page = await fetchGalleryPage(galleryCursor);
      setGalleryAssets((prev) => [...prev, ...page.assets]);
      setGalleryCursor(page.endCursor);
      setGalleryHasNext(page.hasNextPage);
    } finally {
      setGalleryLoading(false);
    }
  }, [fetchGalleryPage, galleryHasNext, galleryLoading, galleryCursor]);

  const onPickAsset = useCallback(async (asset: MediaLibrary.Asset) => {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      const uri = info.localUri ?? asset.uri;
      setPickedCoverUri(uri);
      setGalleryVisible(false);
    } catch {
      setPickedCoverUri(asset.uri);
      setGalleryVisible(false);
    }
  }, []);

  const clearCover = useCallback(() => setPickedCoverUri(null), []);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      if (editingPlaylist) {
        let artworkUri: string | null = editingPlaylist.artworkUri;
        if (!pickedCoverUri) {
          artworkUri = null;
        } else if (pickedCoverUri !== editingPlaylist.artworkUri) {
          const copied = await persistPlaylistCoverFromPick(pickedCoverUri);
          artworkUri = copied;
        }
        await updatePlaylist(editingPlaylist.id, {
          name: trimmed,
          artworkUri,
          description: description.trim() ? description.trim() : null,
        });
        await refreshPlaylists();
        await onUpdated?.(editingPlaylist.id);
        onClose();
      } else {
        let artworkUri: string | null = null;
        if (pickedCoverUri) {
          artworkUri = await persistPlaylistCoverFromPick(pickedCoverUri);
        }
        const id = await createPlaylist(trimmed, {
          artworkUri,
          description: description.trim() || null,
        });
        await refreshPlaylists();
        await onCreated?.(id);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }, [
    name,
    description,
    pickedCoverUri,
    saving,
    editingPlaylist,
    refreshPlaylists,
    onCreated,
    onUpdated,
    onClose,
  ]);

  const canSave = name.trim().length > 0 && !saving;
  const isEdit = !!editingPlaylist;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={[styles.root, { paddingTop: insets.top }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.topBar}>
            <Pressable onPress={onClose} hitSlop={12} disabled={saving}>
              <Text style={styles.topBarBtn}>Cancelar</Text>
            </Pressable>
            <Text style={styles.title}>
              {isEdit ? 'Editar lista' : 'Nueva lista'}
            </Text>
            <Pressable
              onPress={handleSave}
              hitSlop={12}
              disabled={!canSave}
            >
              <Text
                style={[
                  styles.topBarBtnPrimary,
                  !canSave && styles.topBarBtnDisabled,
                ]}
              >
                {isEdit ? 'Guardar' : 'Crear'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + Spacing.xl },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.coverBlock}>
              <ArtworkImage uri={pickedCoverUri} size={160} radius={Radius.lg} />
              <View style={styles.coverActions}>
                <Pressable onPress={openGallery} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnLabel}>Elegir imagen</Text>
                </Pressable>
                {pickedCoverUri ? (
                  <Pressable onPress={clearCover} style={styles.tertiaryBtn}>
                    <Text style={styles.tertiaryBtnLabel}>Quitar</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nombre de la lista"
              placeholderTextColor={Colors.textTertiary}
              maxLength={200}
              editable={!saving}
            />

            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Añade una descripción"
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={2000}
              editable={!saving}
            />

            {saving ? (
              <ActivityIndicator
                color={Colors.accent}
                style={{ marginTop: Spacing.lg }}
              />
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={galleryVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGalleryVisible(false)}
      >
        <View style={[styles.galleryRoot, { paddingTop: insets.top }]}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Fotos</Text>
            <Pressable onPress={() => setGalleryVisible(false)} hitSlop={12}>
              <Text style={styles.galleryClose}>✕</Text>
            </Pressable>
          </View>
          {galleryLoading && galleryAssets.length === 0 ? (
            <ActivityIndicator
              color={Colors.accent}
              style={{ marginTop: Spacing.xxxl }}
            />
          ) : (
            <FlatList
              data={galleryAssets}
              keyExtractor={(a) => a.id}
              numColumns={GALLERY_COLS}
              columnWrapperStyle={{ gap: GALLERY_GAP, marginBottom: GALLERY_GAP }}
              contentContainerStyle={{
                paddingHorizontal: Spacing.base,
                paddingBottom: insets.bottom + Spacing.base,
              }}
              onEndReachedThreshold={0.4}
              onEndReached={loadMoreGallery}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onPickAsset(item)}
                  style={{ width: thumbSize, height: thumbSize }}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={{
                      width: thumbSize,
                      height: thumbSize,
                      borderRadius: Radius.sm,
                    }}
                    contentFit="cover"
                  />
                </Pressable>
              )}
            />
          )}
          {galleryLoading && galleryAssets.length > 0 ? (
            <ActivityIndicator
              color={Colors.accent}
              style={{ paddingVertical: Spacing.sm }}
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  title: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  topBarBtn: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  topBarBtnPrimary: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.accent,
  },
  topBarBtnDisabled: {
    opacity: 0.4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
  },
  coverBlock: {
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  coverActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  secondaryBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  secondaryBtnLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.accent,
  },
  tertiaryBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  tertiaryBtnLabel: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.bgCard,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  galleryRoot: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  galleryTitle: {
    flex: 1,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  galleryClose: {
    fontSize: 18,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },
});
