package expo.modules.audiometadata

import android.content.Context
import android.net.Uri
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.nio.charset.Charset

/**
 * Extracts embedded lyrics from common audio containers by parsing tags
 * directly, because Android's MediaMetadataRetriever exposes no lyrics field.
 *
 * Supported:
 *   - MP3  / ID3v2.3-2.4  → USLT frame (unsynchronised lyrics).
 *   - MP4 / M4A / ALAC    → "©lyr" iTunes atom.
 *   - FLAC                → Vorbis comment LYRICS / UNSYNCEDLYRICS.
 *
 * Everything is best-effort and heavily bounds-checked: any malformed input or
 * unexpected structure yields null rather than throwing, and only metadata
 * regions are read (audio payload is skipped), so it stays cheap during scans.
 */
object LyricsExtractor {

  // Guard against pathological sizes so a corrupt tag can never OOM the scan.
  private const val MAX_ALLOC = 20 * 1024 * 1024

  fun extract(context: Context, uri: String): String? {
    return try {
      openStream(context, uri).use { raw ->
        val input = BufferedInputStream(raw)
        input.mark(16)
        val sig = ByteArray(12)
        val read = readUpTo(input, sig)
        input.reset()
        if (read < 4) return null

        when {
          sig[0] == 'I'.code.toByte() &&
            sig[1] == 'D'.code.toByte() &&
            sig[2] == '3'.code.toByte() -> parseId3(input)

          sig[0] == 'f'.code.toByte() &&
            sig[1] == 'L'.code.toByte() &&
            sig[2] == 'a'.code.toByte() &&
            sig[3] == 'C'.code.toByte() -> parseFlac(input)

          read >= 8 &&
            sig[4] == 'f'.code.toByte() &&
            sig[5] == 't'.code.toByte() &&
            sig[6] == 'y'.code.toByte() &&
            sig[7] == 'p'.code.toByte() -> parseMp4(input)

          else -> null
        }
      }
    } catch (e: Exception) {
      null
    }
  }

  private fun openStream(context: Context, uri: String): InputStream {
    return if (uri.startsWith("content://") || uri.startsWith("file://")) {
      context.contentResolver.openInputStream(Uri.parse(uri))
        ?: throw IllegalStateException("Could not open stream for $uri")
    } else {
      FileInputStream(File(uri))
    }
  }

  // ── Byte helpers ──────────────────────────────────────────────────────────

  /** Reads up to buf.size bytes; returns how many were actually read. */
  private fun readUpTo(input: InputStream, buf: ByteArray): Int {
    var off = 0
    while (off < buf.size) {
      val r = input.read(buf, off, buf.size - off)
      if (r < 0) break
      off += r
    }
    return off
  }

  /** Reads exactly n bytes or returns null (EOF / too large). */
  private fun readExactly(input: InputStream, n: Int): ByteArray? {
    if (n < 0 || n > MAX_ALLOC) return null
    val buf = ByteArray(n)
    var off = 0
    while (off < n) {
      val r = input.read(buf, off, n - off)
      if (r < 0) return null
      off += r
    }
    return buf
  }

  private fun skipFully(input: InputStream, count: Long) {
    var remaining = count
    while (remaining > 0) {
      val s = input.skip(remaining)
      if (s > 0) {
        remaining -= s
      } else {
        if (input.read() < 0) return
        remaining -= 1
      }
    }
  }

  private fun u32be(b: ByteArray, o: Int): Long =
    ((b[o].toLong() and 0xFF) shl 24) or
      ((b[o + 1].toLong() and 0xFF) shl 16) or
      ((b[o + 2].toLong() and 0xFF) shl 8) or
      (b[o + 3].toLong() and 0xFF)

  private fun u32le(b: ByteArray, o: Int): Long =
    (b[o].toLong() and 0xFF) or
      ((b[o + 1].toLong() and 0xFF) shl 8) or
      ((b[o + 2].toLong() and 0xFF) shl 16) or
      ((b[o + 3].toLong() and 0xFF) shl 24)

  private fun syncsafe(b: ByteArray, o: Int): Int =
    ((b[o].toInt() and 0x7F) shl 21) or
      ((b[o + 1].toInt() and 0x7F) shl 14) or
      ((b[o + 2].toInt() and 0x7F) shl 7) or
      (b[o + 3].toInt() and 0x7F)

  // ── ID3v2 (MP3) ───────────────────────────────────────────────────────────

  private fun parseId3(input: InputStream): String? {
    val header = readExactly(input, 10) ?: return null
    val major = header[3].toInt() and 0xFF
    if (major != 3 && major != 4) return null
    val flags = header[5].toInt() and 0xFF
    val size = syncsafe(header, 6)
    val body = readExactly(input, size) ?: return null

    var pos = 0
    if (flags and 0x40 != 0) {
      // Extended header: v2.4 size is syncsafe and covers the whole ext header;
      // v2.3 size excludes its own 4 length bytes.
      if (pos + 4 > body.size) return null
      pos += if (major == 4) syncsafe(body, pos) else u32be(body, pos).toInt() + 4
    }

    while (pos + 10 <= body.size) {
      if (body[pos].toInt() == 0) break // padding
      val id = String(body, pos, 4, Charsets.ISO_8859_1)
      val frameSize =
        if (major == 4) syncsafe(body, pos + 4) else u32be(body, pos + 4).toInt()
      pos += 10
      if (frameSize <= 0 || pos + frameSize > body.size) break
      if (id == "USLT") {
        decodeUslt(body, pos, frameSize)?.let { return it }
      }
      pos += frameSize
    }
    return null
  }

  /**
   * USLT frame body: [encoding:1][language:3][descriptor (null-terminated)][text].
   */
  private fun decodeUslt(b: ByteArray, off: Int, len: Int): String? {
    if (len < 5) return null
    val encoding = b[off].toInt() and 0xFF
    val end = off + len
    var p = off + 4 // skip encoding + 3-byte language

    when (encoding) {
      0, 3 -> { // single-byte terminator
        while (p < end && b[p].toInt() != 0) p++
        p += 1
      }
      1, 2 -> { // UTF-16 double-byte terminator
        while (p + 1 < end && !(b[p].toInt() == 0 && b[p + 1].toInt() == 0)) p += 2
        p += 2
      }
      else -> return null
    }
    if (p >= end) return null

    val charset: Charset = when (encoding) {
      0 -> Charsets.ISO_8859_1
      1 -> Charsets.UTF_16
      2 -> Charsets.UTF_16BE
      else -> Charsets.UTF_8
    }
    val text = String(b, p, end - p, charset).trim()
    return text.ifBlank { null }
  }

  // ── FLAC ────────────────────────────────────────────────────────────────

  private fun parseFlac(input: InputStream): String? {
    readExactly(input, 4) ?: return null // "fLaC"
    while (true) {
      val h = readExactly(input, 4) ?: return null
      val last = (h[0].toInt() and 0x80) != 0
      val type = h[0].toInt() and 0x7F
      val len =
        ((h[1].toInt() and 0xFF) shl 16) or
          ((h[2].toInt() and 0xFF) shl 8) or
          (h[3].toInt() and 0xFF)
      if (type == 4) { // VORBIS_COMMENT
        val block = readExactly(input, len) ?: return null
        return parseVorbisComments(block)
      }
      skipFully(input, len.toLong())
      if (last) break
    }
    return null
  }

  private fun parseVorbisComments(block: ByteArray): String? {
    var p = 0
    if (p + 4 > block.size) return null
    val vendorLen = u32le(block, p).toInt(); p += 4
    if (vendorLen < 0 || p + vendorLen > block.size) return null
    p += vendorLen
    if (p + 4 > block.size) return null
    val count = u32le(block, p).toInt(); p += 4

    var i = 0
    while (i < count) {
      if (p + 4 > block.size) return null
      val l = u32le(block, p).toInt(); p += 4
      if (l < 0 || p + l > block.size) return null
      val comment = String(block, p, l, Charsets.UTF_8); p += l
      val eq = comment.indexOf('=')
      if (eq > 0) {
        val key = comment.substring(0, eq).uppercase()
        if (key == "LYRICS" || key == "UNSYNCEDLYRICS" || key.startsWith("LYRICS")) {
          val value = comment.substring(eq + 1)
          if (value.isNotBlank()) return value
        }
      }
      i++
    }
    return null
  }

  // ── MP4 / M4A ─────────────────────────────────────────────────────────────

  private fun parseMp4(input: InputStream): String? = findMp4Lyrics(input, Long.MAX_VALUE)

  /**
   * Walks atoms within the current container, consuming exactly `remaining`
   * bytes (so sibling atoms stay aligned) unless a match is found. Recurses into
   * moov / udta / meta / ilst / ©lyr and reads the "data" payload.
   */
  private fun findMp4Lyrics(input: InputStream, remaining: Long): String? {
    var rem = remaining
    while (rem >= 8) {
      val head = readExactly(input, 8) ?: return null
      rem -= 8
      var size = u32be(head, 0)
      var headerBytes = 8L
      when {
        size == 1L -> {
          val ext = readExactly(input, 8) ?: return null
          rem -= 8
          size = u64be(ext, 0)
          headerBytes = 16L
        }
        size == 0L -> size = rem + headerBytes // extends to end of container
      }
      val bodyLen = size - headerBytes
      if (bodyLen < 0 || bodyLen > rem) return null

      val type = String(head, 4, 4, Charsets.ISO_8859_1)
      val isLyr = head[4] == 0xA9.toByte() &&
        head[5] == 'l'.code.toByte() &&
        head[6] == 'y'.code.toByte() &&
        head[7] == 'r'.code.toByte()

      when {
        type == "moov" || type == "udta" || type == "ilst" || isLyr -> {
          findMp4Lyrics(input, bodyLen)?.let { return it }
        }
        type == "meta" -> {
          // Full box: 4 bytes of version/flags precede the child atoms.
          readExactly(input, 4) ?: return null
          findMp4Lyrics(input, bodyLen - 4)?.let { return it }
        }
        type == "data" -> {
          val data = readExactly(input, bodyLen.toInt()) ?: return null
          // 4 bytes version/flags + 4 bytes reserved, then the UTF-8 value.
          if (data.size > 8) {
            val value = String(data, 8, data.size - 8, Charsets.UTF_8).trim()
            if (value.isNotBlank()) return value
          }
        }
        else -> skipFully(input, bodyLen)
      }
      rem -= bodyLen
    }
    if (rem > 0) skipFully(input, rem)
    return null
  }

  private fun u64be(b: ByteArray, o: Int): Long =
    (u32be(b, o) shl 32) or u32be(b, o + 4)
}
