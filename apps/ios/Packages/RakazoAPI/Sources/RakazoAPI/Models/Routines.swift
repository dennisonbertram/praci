import Foundation

public enum RoutinePausedReason: Sendable, Hashable, Decodable {
  case errors, noisy, budget, access
  case unknown(String)

  public init(from decoder: Decoder) throws {
    let raw = try decoder.singleValueContainer().decode(String.self)
    switch raw {
    case "errors": self = .errors
    case "noisy": self = .noisy
    case "budget": self = .budget
    case "access": self = .access
    default: self = .unknown(raw)
    }
  }
}

public struct RoutineStatus: Sendable, Hashable, Decodable {
  public let lastRunAt: String?
  public let nextRunAt: String?
  public let pausedReason: RoutinePausedReason?
}

/// A routine from `rpc_routines_list`, and the output of `rpc_routines_update`.
public struct Routine: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let botId: String
  public let name: String
  public let prompt: String
  public let crons: [String]
  public let timezone: String
  public let active: Bool
  public let lastRunAt: String?
  public let nextRunAt: String?
  public let status: RoutineStatus?

  public init(
    id: String, botId: String, name: String, prompt: String = "", crons: [String] = [],
    timezone: String = "UTC", active: Bool = true, lastRunAt: String? = nil,
    nextRunAt: String? = nil, status: RoutineStatus? = nil
  ) {
    self.id = id
    self.botId = botId
    self.name = name
    self.prompt = prompt
    self.crons = crons
    self.timezone = timezone
    self.active = active
    self.lastRunAt = lastRunAt
    self.nextRunAt = nextRunAt
    self.status = status
  }

  enum CodingKeys: String, CodingKey {
    case id, botId, name, prompt, crons, timezone, active, lastRunAt, nextRunAt, status
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    botId = try container.decode(String.self, forKey: .botId)
    name = try container.decode(String.self, forKey: .name)
    prompt = try container.decodeIfPresent(String.self, forKey: .prompt) ?? ""
    crons = try container.decodeIfPresent([String].self, forKey: .crons) ?? []
    timezone = try container.decodeIfPresent(String.self, forKey: .timezone) ?? "UTC"
    active = try container.decodeIfPresent(Bool.self, forKey: .active) ?? true
    lastRunAt = try container.decodeIfPresent(String.self, forKey: .lastRunAt)
    nextRunAt = try container.decodeIfPresent(String.self, forKey: .nextRunAt)
    status = try container.decodeIfPresent(RoutineStatus.self, forKey: .status)
  }

  /// A paused routine has `active == false`; the server may also set a reason when it paused it.
  public var pausedReason: RoutinePausedReason? { status?.pausedReason }
}

public enum RunStatus: Sendable, Hashable, Decodable {
  case queued, leased, running, waitingInput, waitingTakeover, completed, failed, cancelled
  case unknown(String)

  public init(from decoder: Decoder) throws {
    let raw = try decoder.singleValueContainer().decode(String.self)
    switch raw {
    case "queued": self = .queued
    case "leased": self = .leased
    case "running": self = .running
    case "waiting_input": self = .waitingInput
    case "waiting_takeover": self = .waitingTakeover
    case "completed": self = .completed
    case "failed": self = .failed
    case "cancelled": self = .cancelled
    default: self = .unknown(raw)
    }
  }
}

/// One run in `rpc_routines_history`.
public struct RoutineRun: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let botId: String?
  public let status: RunStatus
  public let error: String?
  public let createdAt: String
  public let startedAt: String?
  public let completedAt: String?
  public let preview: String?
  public let silent: Bool?
}

public struct RoutineCursor: Sendable, Hashable, Codable {
  public let id: String
  public let createdAt: String
}

public struct RoutineHistory: Sendable, Decodable {
  public let runs: [RoutineRun]
  public let nextCursor: RoutineCursor?
}

public struct RoutinesListInput: Encodable, Sendable {
  public let botId: String
  public init(botId: String) { self.botId = botId }
}

public struct RoutineHistoryInput: Encodable, Sendable {
  public let routineId: String
  public let before: RoutineCursor?
  public init(routineId: String, before: RoutineCursor? = nil) {
    self.routineId = routineId
    self.before = before
  }
}

public struct RoutineActiveInput: Encodable, Sendable {
  public let routineId: String
  public let active: Bool
  public init(routineId: String, active: Bool) {
    self.routineId = routineId
    self.active = active
  }
}

/// Plain-English schedule from cron expressions. Common shapes only (daily, weekdays, weekly,
/// monthly); anything else shows the expression itself, so nothing is described wrongly.
public enum CronText {
  private static let days = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  ]

  public static func describe(_ cron: String) -> String {
    let fields = cron.split(separator: " ").map(String.init)
    guard fields.count == 5, let minute = Int(fields[0]), let hour = Int(fields[1]), fields[3] == "*",
      (0..<60).contains(minute), (0..<24).contains(hour)
    else { return cron }
    let time = clock(hour: hour, minute: minute)
    switch (fields[2], fields[4]) {
    case ("*", "*"): return "Every day at \(time)"
    case ("*", "1-5"): return "Weekdays at \(time)"
    case ("*", let weekday) where Int(weekday).map({ (0...7).contains($0) }) == true:
      return "Every \(days[Int(weekday)!]) at \(time)"
    case (let dom, "*") where Int(dom).map({ (1...31).contains($0) }) == true:
      return "Monthly on day \(dom) at \(time)"
    default: return cron
    }
  }

  public static func describe(_ crons: [String]) -> String {
    crons.isEmpty ? "No schedule" : crons.map(describe).joined(separator: ", ")
  }

  private static func clock(hour: Int, minute: Int) -> String {
    let twelve = hour % 12 == 0 ? 12 : hour % 12
    return String(format: "%d:%02d %@", twelve, minute, hour < 12 ? "AM" : "PM")
  }
}
