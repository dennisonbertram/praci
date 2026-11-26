import Foundation

/// Which computer an agent uses. Unknown values decode to `.unknown`.
public enum ComputerMode: Sendable, Hashable, Decodable {
  case team
  case dedicated
  case unknown(String)

  public init(from decoder: Decoder) throws {
    let raw = try decoder.singleValueContainer().decode(String.self)
    switch raw {
    case "team": self = .team
    case "dedicated": self = .dedicated
    default: self = .unknown(raw)
    }
  }
}

public enum ComputerState: Sendable, Hashable, Decodable {
  case stopped
  case booting
  case running
  case suspended
  case error
  case unknown(String)

  public init(from decoder: Decoder) throws {
    let raw = try decoder.singleValueContainer().decode(String.self)
    switch raw {
    case "stopped": self = .stopped
    case "booting": self = .booting
    case "running": self = .running
    case "suspended": self = .suspended
    case "error": self = .error
    default: self = .unknown(raw)
    }
  }
}

public enum ComputerControlHolder: Sendable, Hashable, Decodable {
  case bot
  case user
  case none
  case unknown(String)

  public init(from decoder: Decoder) throws {
    let raw = try decoder.singleValueContainer().decode(String.self)
    switch raw {
    case "bot": self = .bot
    case "user": self = .user
    case "none": self = .none
    default: self = .unknown(raw)
    }
  }
}

/// `rpc_computer_status`, and the output of `rpc_computer_boot`.
public struct ComputerStatus: Sendable, Hashable, Decodable {
  public let botId: String
  public let mode: ComputerMode
  /// Sandbox provider, such as `docker` or `fake`.
  public let kind: String
  public let state: ComputerState
  public let controlHolder: ComputerControlHolder
  public let controlBotId: String?
  public let takeoverRequested: Bool
  public let screenAvailable: Bool
  public let screenWidth: Int?
  public let screenHeight: Int?
  public let homeRevision: String?
  /// Name of the agent that is using the computer, when one is.
  public let busyBotName: String?

  public init(
    botId: String, mode: ComputerMode = .team, kind: String = "fake",
    state: ComputerState = .running, controlHolder: ComputerControlHolder = .none,
    controlBotId: String? = nil, takeoverRequested: Bool = false, screenAvailable: Bool = true,
    screenWidth: Int? = 1280, screenHeight: Int? = 800, homeRevision: String? = nil,
    busyBotName: String? = nil
  ) {
    self.botId = botId
    self.mode = mode
    self.kind = kind
    self.state = state
    self.controlHolder = controlHolder
    self.controlBotId = controlBotId
    self.takeoverRequested = takeoverRequested
    self.screenAvailable = screenAvailable
    self.screenWidth = screenWidth
    self.screenHeight = screenHeight
    self.homeRevision = homeRevision
    self.busyBotName = busyBotName
  }

  private enum CodingKeys: String, CodingKey {
    case botId, mode, kind, state, controlHolder, controlBotId, takeoverRequested
    case screenAvailable, screenWidth, screenHeight, homeRevision, busyBotName
  }

  public init(from decoder: Decoder) throws {
    let values = try decoder.container(keyedBy: CodingKeys.self)
    botId = try values.decode(String.self, forKey: .botId)
    mode = try values.decodeIfPresent(ComputerMode.self, forKey: .mode) ?? .team
    kind = try values.decodeIfPresent(String.self, forKey: .kind) ?? ""
    state = try values.decode(ComputerState.self, forKey: .state)
    controlHolder = try values.decodeIfPresent(ComputerControlHolder.self, forKey: .controlHolder) ?? .none
    controlBotId = try values.decodeIfPresent(String.self, forKey: .controlBotId)
    takeoverRequested = try values.decodeIfPresent(Bool.self, forKey: .takeoverRequested) ?? false
    screenAvailable = try values.decodeIfPresent(Bool.self, forKey: .screenAvailable) ?? false
    screenWidth = try values.decodeIfPresent(Int.self, forKey: .screenWidth)
    screenHeight = try values.decodeIfPresent(Int.self, forKey: .screenHeight)
    homeRevision = try values.decodeIfPresent(String.self, forKey: .homeRevision)
    busyBotName = try values.decodeIfPresent(String.self, forKey: .busyBotName)
  }

  /// True when the signed-in user holds the lease for this agent.
  public func userHasControl(of botID: String) -> Bool {
    controlHolder == .user && controlBotId == botID
  }
}

/// `rpc_computer_screenUrl`. `url` is a one-hour capability URL, or nil when there is no screen.
public struct ComputerScreenResponse: Sendable, Decodable {
  public let url: String?
}

/// `rpc_computer_takeover`.
public struct ComputerTakeover: Sendable, Decodable {
  public let leaseId: String
  public let expiresAt: String
}

/// `rpc_computer_heartbeat` and `rpc_computer_release`.
public struct ComputerAck: Sendable, Decodable {
  public let ok: Bool // swiftlint:disable:this identifier_name
}

public enum ComputerReleaseReason: String, Sendable, Encodable {
  case done
  case skipped
}

/// Input of the computer procedures that take only the agent id.
public struct ComputerBotInput: Sendable, Encodable {
  public let botId: String
  public init(botId: String) { self.botId = botId }
}

/// Input of `rpc_computer_release`.
public struct ComputerReleaseInput: Sendable, Encodable {
  public let botId: String
  public let reason: ComputerReleaseReason?
  public init(botId: String, reason: ComputerReleaseReason?) {
    self.botId = botId
    self.reason = reason
  }
}
