import Foundation

#if canImport(FoundationNetworking)
  import FoundationNetworking
#endif

public struct StreamResponse: Sendable {
  public let statusCode: Int
  /// Raw body chunks. For a non-2xx status the stream is not read.
  public let chunks: AsyncThrowingStream<Data, Error>

  public init(statusCode: Int, chunks: AsyncThrowingStream<Data, Error>) {
    self.statusCode = statusCode
    self.chunks = chunks
  }
}

/// Opens a long-lived response and returns once headers arrive. Tests use a fake.
public protocol StreamTransport: Sendable {
  func open(_ request: HTTPRequest) async throws -> StreamResponse
}

/// Clock the event stream uses for its watchdog and backoff. Tests inject a manual one.
public protocol StreamClock: Sendable {
  /// Monotonic time since an arbitrary origin.
  func now() async -> Duration
  func sleep(for duration: Duration) async throws
}

public struct SystemStreamClock: StreamClock {
  private static let origin = ContinuousClock.now

  public init() {}

  public func now() async -> Duration { ContinuousClock.now - Self.origin }

  public func sleep(for duration: Duration) async throws {
    try await Task.sleep(for: duration)
  }
}

public struct URLSessionStreamTransport: StreamTransport {
  public init() {}

  public func open(_ request: HTTPRequest) async throws -> StreamResponse {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.urlCache = nil
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.httpCookieStorage = nil
    configuration.httpShouldSetCookies = false
    // The request timeout is a per-read idle limit; the stream itself may last for hours.
    configuration.timeoutIntervalForRequest = request.timeout
    configuration.timeoutIntervalForResource = 24 * 60 * 60
    let session = URLSession(configuration: configuration)
    var urlRequest = URLRequest(
      url: request.url, cachePolicy: .reloadIgnoringLocalCacheData,
      timeoutInterval: request.timeout)
    urlRequest.httpMethod = request.method
    urlRequest.httpBody = request.body
    for (name, value) in request.headers { urlRequest.setValue(value, forHTTPHeaderField: name) }

    let bytes: URLSession.AsyncBytes
    let response: URLResponse
    do {
      (bytes, response) = try await session.bytes(for: urlRequest, delegate: NoRedirectDelegate())
    } catch {
      session.invalidateAndCancel()
      throw error
    }
    guard let http = response as? HTTPURLResponse else {
      session.invalidateAndCancel()
      throw HTTPTransportError.invalidResponse
    }
    let chunks = AsyncThrowingStream<Data, Error> { continuation in
      let task = Task {
        do {
          var line = Data()
          for try await byte in bytes {
            line.append(byte)
            if byte == 0x0A {
              continuation.yield(line)
              line = Data()
            }
          }
          if !line.isEmpty { continuation.yield(line) }
          continuation.finish()
        } catch {
          continuation.finish(throwing: error)
        }
      }
      continuation.onTermination = { _ in
        task.cancel()
        session.invalidateAndCancel()
      }
    }
    return StreamResponse(statusCode: http.statusCode, chunks: chunks)
  }
}

/// Refuses redirects so the bearer token is never replayed to another host.
private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
  }
}
