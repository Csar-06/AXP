import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from '@/navigation/AppNavigator';
import { useTrackPlayerSync } from '@/hooks/useTrackPlayerSync';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { initDb } from '@/db/schema';
import { setupPlayer } from '@/audio/TrackPlayerSetup';
import { Colors } from '@/theme';

function AppContent() {
  useTrackPlayerSync();
  return <AppNavigator />;
}

type BootStatus = 'idle' | 'db' | 'player' | 'library' | 'done' | 'error';

export default function App() {
  const [status, setStatus] = useState<BootStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const loadAll = useLibraryStore((s) => s.loadAll);
  const scan = useLibraryStore((s) => s.scan);

  useEffect(() => {
    async function boot() {
      try {
        setStatus('db');
        await initDb();
      } catch (e) {
        console.error('[boot] initDb failed:', e);
        setError(`initDb: ${(e as Error)?.message || String(e)}`);
      }

      try {
        setStatus('player');
        await setupPlayer();
      } catch (e) {
        console.error('[boot] setupPlayer failed:', e);
        setError((prev) =>
          (prev ? prev + '\n\n' : '') +
          `setupPlayer: ${(e as Error)?.message || String(e)}`,
        );
      }

      try {
        setStatus('library');
        await loadAll();
      } catch (e) {
        console.error('[boot] loadAll failed:', e);
        setError((prev) =>
          (prev ? prev + '\n\n' : '') +
          `loadAll: ${(e as Error)?.message || String(e)}`,
        );
      }

      setStatus('done');

      const { scanOnStartup } = useSettingsStore.getState();
      if (scanOnStartup) {
        scan().catch((e) =>
          console.warn('[boot] background scan failed:', e),
        );
      }
    }
    boot();
  }, [loadAll, scan]);

  if (status !== 'done') {
    const labels: Record<BootStatus, string> = {
      idle: 'Iniciando...',
      db: 'Inicializando base de datos...',
      player: 'Configurando reproductor...',
      library: 'Cargando biblioteca...',
      done: '',
      error: '',
    };
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.splashLabel}>{labels[status]}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error al iniciar AXP</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </ScrollView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppContent />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  splashLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    flexGrow: 1,
    backgroundColor: Colors.bg,
    padding: 24,
    paddingTop: 80,
    gap: 16,
  },
  errorTitle: {
    color: Colors.accent,
    fontSize: 20,
    fontWeight: '700',
  },
  errorBody: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontFamily: 'monospace',
  },
});
