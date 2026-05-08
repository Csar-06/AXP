import AVFoundation
import ExpoModulesCore

public class AudioMetadataModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAudioMetadata")

    /**
     * Reads all available audio metadata from the given URI.
     *
     * Supports any URL readable by AVFoundation (local file:// paths).
     * Returns a dictionary with only the fields that have a non-nil value.
     */
    AsyncFunction("readAudioMetadata") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let result = try Self.extractMetadata(from: uri)
          promise.resolve(result)
        } catch {
          promise.reject(AudioMetadataError.extractionFailed(error.localizedDescription))
        }
      }
    }
  }

  // MARK: - Private helpers

  private static func extractMetadata(from uri: String) throws -> [String: Any] {
    guard let url = URL(string: uri) else {
      throw AudioMetadataError.invalidUri(uri)
    }

    let asset = AVURLAsset(
      url: url,
      options: [AVURLAssetPreferPreciseDurationAndTimingKey: true]
    )

    var result: [String: Any] = [:]

    // --- Duration ---
    let duration = CMTimeGetSeconds(asset.duration)
    if duration.isFinite && duration > 0 {
      result["duration"] = Int(duration * 1000)
    }

    // --- Technical info from audio track ---
    if let audioTrack = asset.tracks(withMediaType: .audio).first {
      let dataRate = audioTrack.estimatedDataRate
      if dataRate > 0 {
        result["bitrate"] = Int(dataRate)
      }

      if let fmtDesc = audioTrack.formatDescriptions.first {
        // swiftlint:disable force_cast
        let audioFmt = fmtDesc as! CMAudioFormatDescription
        // swiftlint:enable force_cast
        if let streamDesc = CMAudioFormatDescriptionGetStreamBasicDescription(audioFmt) {
          let bitsPerChannel = Int(streamDesc.pointee.mBitsPerChannel)
          let channels       = Int(streamDesc.pointee.mChannelsPerFrame)
          let sampleRate     = streamDesc.pointee.mSampleRate

          if bitsPerChannel > 0 { result["bitsPerSample"] = bitsPerChannel }
          if channels > 0       { result["channels"]      = channels }
          if sampleRate > 0     { result["sampleRate"]    = Int(sampleRate) }
        }
      }
    }

    // --- Metadata tags (common + ID3 + iTunes) ---
    var allItems: [AVMetadataItem] = asset.commonMetadata

    // ID3 tags (MP3)
    if asset.availableMetadataFormats.contains(.id3Metadata) {
      allItems += asset.metadata(forFormat: .id3Metadata)
    }
    // iTunes tags (M4A / AAC)
    if asset.availableMetadataFormats.contains(.iTunesMetadata) {
      allItems += asset.metadata(forFormat: .iTunesMetadata)
    }

    for item in allItems {
      guard let value = item.value else { continue }

      // Common keys (works for all formats)
      if let commonKey = item.commonKey {
        switch commonKey {
        case .commonKeyTitle:
          result["title"] = value as? String
        case .commonKeyArtist:
          result["artist"] = value as? String
        case .commonKeyAlbumName:
          result["album"] = value as? String
        case .commonKeyCreator:
          if result["artist"] == nil { result["artist"] = value as? String }
        case .commonKeyType:
          result["genre"] = value as? String
        case .commonKeyCreationDate:
          result["year"] = value as? String
        case .commonKeyArtwork:
          if let data = value as? Data {
            result["artworkBase64"] = "data:image/jpeg;base64," + data.base64EncodedString()
          }
        default:
          break
        }
        continue
      }

      // Format-specific tags via identifier
      guard let identifier = item.identifier?.rawValue else { continue }

      // ID3v2 frames
      if identifier.contains("TCOM") { result["composer"]    = item.stringValue }
      if identifier.contains("TPE2") { result["albumArtist"] = item.stringValue }
      if identifier.contains("TRCK") { result["trackNumber"] = item.stringValue }
      if identifier.contains("TPOS") { result["discNumber"]  = item.stringValue }
      if identifier.contains("TCON") { result["genre"]       = item.stringValue }
      if identifier.contains("TDRC") || identifier.contains("TYER") {
        result["year"] = item.stringValue
      }
      if identifier.contains("USLT") {
        result["lyrics"] = item.stringValue
      }

      // iTunes atoms (M4A)
      if identifier.contains("©ART") { result["artist"]      = item.stringValue }
      if identifier.contains("©alb") { result["album"]       = item.stringValue }
      if identifier.contains("©nam") { result["title"]       = item.stringValue }
      if identifier.contains("©gen") || identifier.contains("gnre") {
        result["genre"] = item.stringValue
      }
      if identifier.contains("©day") { result["year"]        = item.stringValue }
      if identifier.contains("©wrt") { result["composer"]    = item.stringValue }
      if identifier.contains("aART") { result["albumArtist"] = item.stringValue }
      if identifier.contains("trkn") { result["trackNumber"] = item.stringValue }
      if identifier.contains("disk") { result["discNumber"]  = item.stringValue }
      if identifier.contains("©lyr") { result["lyrics"]      = item.stringValue }
    }

    // Remove nil values
    return result.compactMapValues { $0 }
  }
}

// MARK: - Errors

enum AudioMetadataError: Error {
  case invalidUri(String)
  case extractionFailed(String)
}

extension AudioMetadataError: LocalizedError {
  var errorDescription: String? {
    switch self {
    case .invalidUri(let uri):
      return "Invalid URI: \(uri)"
    case .extractionFailed(let message):
      return "Metadata extraction failed: \(message)"
    }
  }
}
