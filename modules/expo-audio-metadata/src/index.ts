import { requireNativeModule } from 'expo-modules-core';

export type NativeAudioMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  /** Year as a string, e.g. "2024" */
  year?: string;
  composer?: string;
  /** Track number as "X" or "X/Y" (total tracks). */
  trackNumber?: string;
  /** Disc number as "X" or "X/Y" (total discs). */
  discNumber?: string;
  /** Unsynchronized lyrics text (USLT). iOS only; Android not available via native API. */
  lyrics?: string;
  /** Playback duration in milliseconds. */
  duration?: number;
  /** Average bitrate in bits per second. */
  bitrate?: number;
  /** Bits per audio sample (e.g. 16, 24, 32). */
  bitsPerSample?: number;
  /** Sample rate in Hz. iOS only. */
  sampleRate?: number;
  /** Number of audio channels. iOS only. */
  channels?: number;
  /** Embedded artwork as a base64 data URI, e.g. "data:image/jpeg;base64,...". */
  artworkBase64?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ExpoAudioMetadata: { readAudioMetadata: (uri: string) => Promise<NativeAudioMetadata> } =
  requireNativeModule('ExpoAudioMetadata');

/**
 * Read audio metadata from a local file URI.
 *
 * On Android supports both POSIX paths (`file://`) and SAF URIs (`content://`).
 * On iOS supports any URL readable by AVFoundation.
 *
 * Returns an object with the available fields; absent fields are omitted.
 */
export async function readAudioMetadata(uri: string): Promise<NativeAudioMetadata> {
  return ExpoAudioMetadata.readAudioMetadata(uri);
}
