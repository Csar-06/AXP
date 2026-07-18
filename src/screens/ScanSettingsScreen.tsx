import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useLibraryStore } from '@/store/libraryStore';
import {
  useSettingsStore,
  type DefaultSort,
  type LyricsSource,
} from '@/store/settingsStore';
import { addScanPath, removeScanPath } from '@/db/library';
import { Colors, Spacing, Typography, Radius } from '@/theme';

const FOLDER_PRESETS: { label: string; path: string }[] = Platform.select({
  android: [
    { label: 'Música', path: '/storage/emulated/0/Music' },
    { label: 'Descargas', path: '/storage/emulated/0/Download' },
    { label: 'Documentos', path: '/storage/emulated/0/Documents' },
  ],
  ios: [
    { label: 'Documentos de la App', path: 'Documents/' },
  ],
  default: [],
}) ?? [];

const SORT_OPTIONS: { value: DefaultSort; label: string }[] = [
  { value: 'title', label: 'Título' },
  { value: 'artist', label: 'Artista' },
  { value: 'album', label: 'Álbum' },
  { value: 'dateAdded', label: 'Fecha de adición' },
];

const LYRICS_SOURCE_OPTIONS: {
  value: LyricsSource;
  label: string;
  description: string;
}[] = [
  {
    value: 'auto',
    label: 'Automático',
    description: 'Metadatos y archivos .lrc (prioriza metadatos).',
  },
  {
    value: 'metadata',
    label: 'Metadatos',
    description: 'Solo letras incrustadas en la pista.',
  },
  {
    value: 'lrc',
    label: 'Archivos .lrc',
    description: 'Solo archivos .lrc junto a la pista.',
  },
];

function pathLabel(p: string): string {
  if (!p.startsWith('content://')) return p;
  const docMarker = '/tree/';
  const idx = p.indexOf(docMarker);
  if (idx < 0) return p;
  try {
    const id = decodeURIComponent(p.substring(idx + docMarker.length));
    // Common SAF tree id format: "primary:Music"
    const colon = id.indexOf(':');
    return colon >= 0 ? id.substring(colon + 1) || '/' : id;
  } catch {
    return p;
  }
}

export function ScanSettingsScreen() {
  const insets = useSafeAreaInsets();

  const scanPaths = useLibraryStore((s) => s.scanPaths);
  const isScanning = useLibraryStore((s) => s.isScanning);
  const scanProgress = useLibraryStore((s) => s.scanProgress);
  const lastScanResult = useLibraryStore((s) => s.lastScanResult);
  const scan = useLibraryStore((s) => s.scan);
  const loadScanPaths = useLibraryStore((s) => s.loadScanPaths);

  const settings = useSettingsStore();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const [sortPickerVisible, setSortPickerVisible] = useState(false);
  const [lyricsPickerVisible, setLyricsPickerVisible] = useState(false);

  const openPathPicker = useCallback(() => {
    setPathInput('');
    setPickerVisible(true);
  }, []);

  const pickFolderViaSaf = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const result =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!result.granted) return;
      await addScanPath(result.directoryUri);
      await loadScanPaths();
      setPickerVisible(false);
    } catch (e) {
      Alert.alert(
        'No se pudo abrir el explorador',
        (e as Error)?.message ?? 'Inténtalo de nuevo.',
      );
    }
  }, [loadScanPaths]);

  const submitPath = useCallback(
    async (path: string) => {
      const trimmed = path.trim();
      if (!trimmed) return;
      // For absolute Android paths we still need legacy permission.
      if (Platform.OS === 'android' && trimmed.startsWith('/')) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permiso requerido',
            'AXP necesita acceso a los archivos para escanear esta ruta.',
          );
          return;
        }
      }
      await addScanPath(trimmed);
      await loadScanPaths();
      setPickerVisible(false);
      setPathInput('');
    },
    [loadScanPaths],
  );

  const handleRemovePath = useCallback(
    (path: string) => {
      Alert.alert('Eliminar carpeta', `¿Eliminar "${path}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await removeScanPath(path);
            await loadScanPaths();
          },
        },
      ]);
    },
    [loadScanPaths],
  );

  const handleScan = useCallback(async () => {
    if (scanPaths.length === 0) {
      Alert.alert('Sin rutas', 'Agrega al menos una carpeta primero.');
      return;
    }
    await scan();
  }, [scan, scanPaths]);

  const sortLabel = SORT_OPTIONS.find((o) => o.value === settings.defaultSort)?.label;
  const lyricsSourceLabel = LYRICS_SOURCE_OPTIONS.find(
    (o) => o.value === settings.lyricsSource,
  )?.label;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
      >
        <Section title="Biblioteca">
          {scanPaths.length === 0 ? (
            <Text style={styles.emptyText}>
              No hay carpetas configuradas. Agrega una para empezar.
            </Text>
          ) : (
            scanPaths.map((p) => {
              const isSaf = p.startsWith('content://');
              return (
                <View key={p} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {pathLabel(p)}
                    </Text>
                    <Text style={styles.rowDesc} numberOfLines={1}>
                      {isSaf ? 'SAF · acceso persistente' : p}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRemovePath(p)}
                    hitSlop={8}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </Pressable>
                </View>
              );
            })
          )}
          <Pressable style={styles.primaryBtnOutline} onPress={openPathPicker}>
            <Text style={styles.primaryBtnOutlineText}>+ Agregar carpeta</Text>
          </Pressable>
        </Section>

        <Section title="Escaneo">
          {isScanning ? (
            <View style={styles.scanningState}>
              <ActivityIndicator color={Colors.accent} />
              {scanProgress && (
                <Text style={styles.helperText}>
                  {scanProgress.processed} / {scanProgress.total} archivos
                </Text>
              )}
            </View>
          ) : (
            <>
              {lastScanResult && (
                <Text style={styles.helperText}>
                  Último escaneo: {lastScanResult.added} agregadas ·{' '}
                  {lastScanResult.removed} eliminadas
                </Text>
              )}
              <Pressable
                style={[
                  styles.primaryBtn,
                  scanPaths.length === 0 && styles.primaryBtnDisabled,
                ]}
                onPress={handleScan}
                disabled={scanPaths.length === 0}
              >
                <Text style={styles.primaryBtnText}>Escanear ahora</Text>
              </Pressable>
              <ToggleRow
                label="Escanear al iniciar"
                description="Busca cambios en las carpetas cada vez que abras AXP."
                value={settings.scanOnStartup}
                onChange={settings.setScanOnStartup}
              />
            </>
          )}
        </Section>

        <Section title="Reproducción">
          <ToggleRow
            label="Pausar en pérdida de foco"
            description="Pausa la música al recibir llamadas u otra app de audio."
            value={settings.pauseOnAudioFocusLoss}
            onChange={settings.setPauseOnAudioFocusLoss}
          />
        </Section>

        <Section title="Letras">
          <Pressable
            style={styles.row}
            onPress={() => setLyricsPickerVisible(true)}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowLabel}>Fuente de letras</Text>
              <Text style={styles.rowDesc}>
                De dónde se obtienen las letras de las canciones.
              </Text>
            </View>
            <Text style={styles.rowValue}>{lyricsSourceLabel}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Section>

        <Section title="Apariencia">
          <ToggleRow
            label="Tematizado dinámico"
            description="Adapta el fondo del reproductor al color del álbum."
            value={settings.dynamicTheming}
            onChange={settings.setDynamicTheming}
          />
          <ToggleRow
            label="Mostrar etiqueta Lossless"
            description="Marca FLAC, ALAC, WAV en pistas y reproductor."
            value={settings.showLosslessBadge}
            onChange={settings.setShowLosslessBadge}
          />
        </Section>

        <Section title="Biblioteca avanzado">
          <ToggleRow
            label="Preferir Album Artist"
            description="Usa Album Artist en lugar de Artist al agrupar."
            value={settings.preferAlbumArtist}
            onChange={settings.setPreferAlbumArtist}
          />
          <Pressable
            style={styles.row}
            onPress={() => setSortPickerVisible(true)}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowLabel}>Orden por defecto</Text>
              <Text style={styles.rowValue}>{sortLabel}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Section>

        <Section title="Acerca de">
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowLabel}>AXP</Text>
              <Text style={styles.rowValue}>Versión 1.0.0</Text>
            </View>
          </View>
        </Section>
      </ScrollView>

      {/* Add path modal */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalCard}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>Agregar carpeta</Text>

            {Platform.OS === 'android' && (
              <>
                <Text style={styles.modalSub}>
                  Recomendado: usa el explorador del sistema para conceder acceso
                  persistente a una carpeta.
                </Text>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={pickFolderViaSaf}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    Abrir explorador del sistema
                  </Text>
                </Pressable>
                <View style={styles.divider} />
                <Text style={styles.modalSubLabel}>Opciones avanzadas</Text>
              </>
            )}

            {FOLDER_PRESETS.length > 0 && (
              <View style={styles.presetGrid}>
                {FOLDER_PRESETS.map((p) => (
                  <Pressable
                    key={p.path}
                    style={styles.presetBtn}
                    onPress={() => submitPath(p.path)}
                  >
                    <Text style={styles.presetLabel}>{p.label}</Text>
                    <Text style={styles.presetPath} numberOfLines={1}>
                      {p.path}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <TextInput
              value={pathInput}
              onChangeText={setPathInput}
              placeholder={
                Platform.OS === 'android'
                  ? '/storage/emulated/0/Music'
                  : 'Documents/'
              }
              placeholderTextColor={Colors.textTertiary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setPickerVisible(false)}
              >
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  !pathInput.trim() && styles.primaryBtnDisabled,
                ]}
                onPress={() => submitPath(pathInput)}
                disabled={!pathInput.trim()}
              >
                <Text style={styles.modalBtnPrimaryText}>Agregar ruta</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Sort picker modal */}
      <Modal
        visible={sortPickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSortPickerVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSortPickerVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Orden por defecto</Text>
            {SORT_OPTIONS.map((opt) => {
              const selected = settings.defaultSort === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.row, selected && styles.rowSelected]}
                  onPress={() => {
                    settings.setDefaultSort(opt.value);
                    setSortPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.rowLabel,
                      selected && { color: Colors.accent },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {selected && <Text style={styles.checkMark}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Lyrics source picker modal */}
      <Modal
        visible={lyricsPickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setLyricsPickerVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setLyricsPickerVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Fuente de letras</Text>
            {LYRICS_SOURCE_OPTIONS.map((opt) => {
              const selected = settings.lyricsSource === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.row, selected && styles.rowSelected]}
                  onPress={() => {
                    settings.setLyricsSource(opt.value);
                    setLyricsPickerVisible(false);
                  }}
                >
                  <View style={styles.rowMain}>
                    <Text
                      style={[
                        styles.rowLabel,
                        selected && { color: Colors.accent },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={styles.rowDesc}>{opt.description}</Text>
                  </View>
                  {selected && <Text style={styles.checkMark}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description && <Text style={styles.rowDesc}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.bgElevated, true: Colors.accentMuted }}
        thumbColor={value ? Colors.accent : Colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  section: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  rowSelected: {
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
  },
  rowValue: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  rowDesc: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
  },
  rowText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textTertiary,
  },
  checkMark: {
    fontSize: 18,
    color: Colors.accent,
  },
  emptyText: {
    fontSize: Typography.base,
    color: Colors.textTertiary,
    paddingVertical: Spacing.md,
  },
  helperText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    paddingVertical: Spacing.xs,
  },
  removeBtn: { padding: 4 },
  removeBtnText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  primaryBtnOutline: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  primaryBtnOutlineText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.accent,
  },
  scanningState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: Spacing.base,
  },
  modalScroll: {
    flexGrow: 0,
    maxHeight: '90%',
  },
  modalCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  modalSub: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  modalSubLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
    marginVertical: Spacing.xs,
  },
  presetGrid: {
    gap: Spacing.xs,
  },
  presetBtn: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: 2,
  },
  presetLabel: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
  },
  presetPath: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  input: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  modalBtnGhost: {
    backgroundColor: Colors.bg,
  },
  modalBtnGhostText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  modalBtnPrimary: {
    backgroundColor: Colors.accent,
  },
  modalBtnPrimaryText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.semibold,
  },
});
