import Foundation

/// `rpc_calendar_agenda` item kind.
public enum CalendarItemKind: Sendable, Hashable, Decodable {
  case event, todo, checkBack, routine
  case unknown(String)

  public init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    let raw = try c.decode(String.self)
    switch raw {
    case "event": self = .event
    case "todo": self = .todo
    case "check_back": self = .checkBack
    case "routine": self = .routine
    default: self = .unknown(raw)
    }
  }
}

/// `rpc_calendar_agenda` row.
public struct CalendarItem: Sendable, Identifiable, Hashable, Decodable {
  public let id: String
  public let kind: CalendarItemKind
  public let title: String
  public let start: String
  public let end: String?
  public let allDay: Bool
  public let botId: String?
  public let botName: String?
  public let account: String?
  public let href: String?
  public let joinUrl: String?
  public let mailId: String?

  public init(
    id: String, kind: CalendarItemKind, title: String, start: String, end: String?, allDay: Bool,
    botId: String?, botName: String?, account: String?, href: String?, joinUrl: String?, mailId: String?
  ) {
    self.id = id
    self.kind = kind
    self.title = title
    self.start = start
    self.end = end
    self.allDay = allDay
    self.botId = botId
    self.botName = botName
    self.account = account
    self.href = href
    self.joinUrl = joinUrl
    self.mailId = mailId
  }
}

public struct CalendarAgendaError: Sendable, Hashable, Decodable {
  public let account: String
  public let message: String
  public let reconnect: Bool?
}

/// `rpc_calendar_agenda` response.
public struct CalendarAgenda: Sendable, Decodable {
  public let items: [CalendarItem]
  public let errors: [CalendarAgendaError]
  public let googleConnected: Bool
}

/// `rpc_scratchpad_waitingOnYou` row.
public struct WaitingOnYouItem: Sendable, Identifiable, Decodable {
  public let id: String
  public let botId: String
  public let botName: String
  public let title: String
  public let waitingOn: String?
  public let dueAt: String?
}
