package expo.modules.audiometadata

import android.media.MediaMetadataRetriever
import android.media.MediaMetadataRetriever.METADATA_KEY_ALBUM
import android.media.MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST
import android.media.MediaMetadataRetriever.METADATA_KEY_ARTIST
import android.media.MediaMetadataRetriever.METADATA_KEY_BITRATE
import android.media.MediaMetadataRetriever.METADATA_KEY_BITS_PER_SAMPLE
import android.media.MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER
import android.media.MediaMetadataRetriever.METADATA_KEY_COMPOSER
import android.media.MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER
import android.media.MediaMetadataRetriever.METADATA_KEY_DURATION
import android.media.MediaMetadataRetriever.METADATA_KEY_GENRE
import android.media.MediaMetadataRetriever.METADATA_KEY_TITLE
import android.media.MediaMetadataRetriever.METADATA_KEY_YEAR
import android.net.Uri
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AudioMetadataModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoAudioMetadata")

    /**
     * Reads all available audio metadata from the given URI.
     *
     * AsyncFunction runs on a worker thread by default — no explicit
     * Coroutine block needed; this keeps compatibility with old arch.
     *
     * Supports both POSIX file paths (file://) and Android SAF URIs (content://).
     * Returns a map containing only the fields that have a non-null value.
     */
    AsyncFunction("readAudioMetadata") { uri: String ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("React context is not available")

      val retriever = MediaMetadataRetriever()
      val result = try {
        retriever.setDataSource(context, Uri.parse(uri))
        buildResult(retriever)
      } finally {
        retriever.release()
      }

      // MediaMetadataRetriever exposes no lyrics field — parse the tags directly.
      if (!result.containsKey("lyrics")) {
        LyricsExtractor.extract(context, uri)?.let { result["lyrics"] = it }
      }

      result
    }
  }

  private fun buildResult(r: MediaMetadataRetriever): MutableMap<String, Any> {
    val map = mutableMapOf<String, Any>()

    // Text tags
    r.extractMetadata(METADATA_KEY_TITLE)?.let       { map["title"]       = it }
    r.extractMetadata(METADATA_KEY_ARTIST)?.let      { map["artist"]      = it }
    r.extractMetadata(METADATA_KEY_ALBUM)?.let       { map["album"]       = it }
    r.extractMetadata(METADATA_KEY_ALBUMARTIST)?.let { map["albumArtist"] = it }
    r.extractMetadata(METADATA_KEY_GENRE)?.let       { map["genre"]       = it }
    r.extractMetadata(METADATA_KEY_YEAR)?.let        { map["year"]        = it }
    r.extractMetadata(METADATA_KEY_COMPOSER)?.let    { map["composer"]    = it }

    // Track / disc numbers returned as "X/Y" strings by the OS
    r.extractMetadata(METADATA_KEY_CD_TRACK_NUMBER)?.let { map["trackNumber"] = it }
    r.extractMetadata(METADATA_KEY_DISC_NUMBER)?.let     { map["discNumber"]  = it }

    // Technical fields
    r.extractMetadata(METADATA_KEY_DURATION)?.toLongOrNull()?.let       { map["duration"]      = it }
    r.extractMetadata(METADATA_KEY_BITRATE)?.toLongOrNull()?.let        { map["bitrate"]       = it }
    r.extractMetadata(METADATA_KEY_BITS_PER_SAMPLE)?.toIntOrNull()?.let { map["bitsPerSample"] = it }

    // Embedded artwork → base64 data URI
    r.embeddedPicture?.let { bytes ->
      val encoded = Base64.encodeToString(bytes, Base64.NO_WRAP)
      map["artworkBase64"] = "data:image/jpeg;base64,$encoded"
    }

    return map
  }
}
