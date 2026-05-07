/**
 * OGG/OPUS transcoding for iOS.
 *
 * On Android, ExoPlayer handles OGG and OPUS natively — no transcoding needed.
 * On iOS, AVFoundation does not support OGG/OPUS. This module is a placeholder
 * for a future iOS transcoder (e.g. via a maintained FFmpeg fork or libopus binding).
 * For now, OGG/OPUS files on iOS will fall back to the original URI and produce
 * a playback error — all other formats work normally on both platforms.
 */
import { Platform } from 'react-native';

const NEEDS_TRANSCODE_IOS = ['.ogg', '.opus'];

function needsTranscode(uri: string): boolean {
  if (Platform.OS !== 'ios') return false;
  const lower = uri.toLowerCase();
  return NEEDS_TRANSCODE_IOS.some((ext) => lower.endsWith(ext));
}

export async function resolvePlaybackUri(uri: string): Promise<string> {
  if (!needsTranscode(uri)) return uri;
  // iOS OGG/OPUS: return original URI (will fail gracefully in AVFoundation).
  // Replace this with a working transcoder when targeting iOS with OGG/OPUS content.
  return uri;
}

export async function clearTranscodeCache(): Promise<void> {
  // No-op until a transcoder is implemented for iOS.
}
