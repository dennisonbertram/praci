import Foundation

/// `rpc_voice_catalog` item: a voice provider the server can use.
public struct VoiceProvider: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let name: String
  public let description: String
  /// Whether the provider also transcribes speech.
  public let transcribe: Bool
  public let speech: Bool

  private enum CodingKeys: String, CodingKey { case id, name, description, transcribe, speech }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    name = try container.decode(String.self, forKey: .name)
    description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
    transcribe = try container.decodeIfPresent(Bool.self, forKey: .transcribe) ?? false
    speech = try container.decodeIfPresent(Bool.self, forKey: .speech) ?? true
  }
}

/// `rpc_voice_credentials` item and the result of `rpc_voice_connect`. The key itself is never returned.
public struct VoiceCredential: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let provider: String
  public let hasKey: Bool
  public let isDefault: Bool
  public let voiceId: String
  public let speechModel: String
  public let transcribe: Bool

  private enum CodingKeys: String, CodingKey {
    case id, provider, hasKey, isDefault, voiceId, speechModel, transcribe
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    provider = try container.decode(String.self, forKey: .provider)
    hasKey = try container.decodeIfPresent(Bool.self, forKey: .hasKey) ?? true
    isDefault = try container.decodeIfPresent(Bool.self, forKey: .isDefault) ?? false
    voiceId = try container.decodeIfPresent(String.self, forKey: .voiceId) ?? ""
    speechModel = try container.decodeIfPresent(String.self, forKey: .speechModel) ?? ""
    transcribe = try container.decodeIfPresent(Bool.self, forKey: .transcribe) ?? false
  }
}

/// `rpc_voice_status` and the result of `rpc_voice_setVoice`.
public struct VoiceStatus: Sendable, Hashable, Decodable {
  public let configured: Bool
  public let ready: Bool
  public let transcribe: Bool
  public let provider: String?
  public let voiceId: String
  public let transcriptionProvider: String?
  public let transcriptionReady: Bool
  /// Nil on older servers.
  public let transcriptionConsented: Bool?

  private enum CodingKeys: String, CodingKey {
    case configured, ready, transcribe, provider, voiceId, transcriptionProvider, transcriptionReady
    case transcriptionConsented
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    configured = try container.decodeIfPresent(Bool.self, forKey: .configured) ?? false
    ready = try container.decodeIfPresent(Bool.self, forKey: .ready) ?? false
    transcribe = try container.decodeIfPresent(Bool.self, forKey: .transcribe) ?? false
    provider = try container.decodeIfPresent(String.self, forKey: .provider)
    voiceId = try container.decodeIfPresent(String.self, forKey: .voiceId) ?? ""
    transcriptionProvider = try container.decodeIfPresent(String.self, forKey: .transcriptionProvider)
    transcriptionReady = try container.decodeIfPresent(Bool.self, forKey: .transcriptionReady) ?? false
    transcriptionConsented = try container.decodeIfPresent(Bool.self, forKey: .transcriptionConsented)
  }
}

/// `rpc_voice_voices` item: a voice the connected provider offers.
public struct VoiceOption: Sendable, Hashable, Decodable, Identifiable {
  public let id: String
  public let label: String
  public let description: String?
}
