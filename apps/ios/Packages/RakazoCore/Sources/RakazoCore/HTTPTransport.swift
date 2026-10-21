import Foundation

#if canImport(FoundationNetworking)
  import FoundationNetworking
#endif

public struct HTTPRequest: Sendable {
  public let url: URL
  public let method: String
  public let headers: [String: String]
  public let body: Data?

  public init(url: URL, method: String = "GET", headers: [String: String] = [:], body: Data? = nil)
  {
    self.url = url
    self.method = method
    self.headers = headers
    self.body = body
  }
}

public struct HTTPResponse: Sendable {
  public let statusCode: Int
  public let headers: [String: String]
  public let body: Data

  public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) {
    self.statusCode = statusCode
    self.headers = Dictionary(
      headers.map { ($0.key.lowercased(), $0.value) },
      uniquingKeysWith: { first, second in "\(first), \(second)" }
    )
    self.body = body
  }

  public func header(_ name: String) -> String? {
    headers[name.lowercased()]
  }
}

public protocol HTTPTransport: Sendable {
  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse
}

public enum HTTPTransportError: LocalizedError, Sendable, Equatable {
  case invalidResponseLimit
  case invalidResponse
  case responseTooLarge
  case redirectNotAllowed
  case timedOut

  public var errorDescription: String? {
    switch self {
    case .invalidResponseLimit:
      "The response limit is invalid."
    case .invalidResponse:
      "The server returned an invalid response."
    case .responseTooLarge:
      "The server response is too large."
    case .redirectNotAllowed:
      "The server redirected this request."
    case .timedOut:
      "The server request timed out."
    }
  }
}

public struct URLSessionHTTPTransport: HTTPTransport {
  public init() {}

  public func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    guard maximumResponseBytes >= 0 else {
      throw HTTPTransportError.invalidResponseLimit
    }

    let configuration = URLSessionConfiguration.ephemeral
    configuration.urlCache = nil
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.httpCookieStorage = nil
    configuration.httpShouldSetCookies = false
    configuration.httpCookieAcceptPolicy = .never
    configuration.timeoutIntervalForRequest = 8
    configuration.timeoutIntervalForResource = 8

    let delegate = BoundedResponseDelegate(maximumResponseBytes: maximumResponseBytes)
    let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
    var urlRequest = URLRequest(
      url: request.url,
      cachePolicy: .reloadIgnoringLocalCacheData,
      timeoutInterval: 8
    )
    urlRequest.httpMethod = request.method
    urlRequest.httpBody = request.body
    for (name, value) in request.headers {
      urlRequest.setValue(value, forHTTPHeaderField: name)
    }
    let dataTask = session.dataTask(with: urlRequest)
    defer { session.invalidateAndCancel() }

    return try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { continuation in
        delegate.install(continuation)
        if Task.isCancelled {
          delegate.fail(CancellationError())
          dataTask.cancel()
        } else {
          dataTask.resume()
        }
      }
    } onCancel: {
      dataTask.cancel()
      delegate.fail(CancellationError())
    }
  }
}

private final class BoundedResponseDelegate: NSObject, URLSessionDataDelegate, @unchecked Sendable {
  private let maximumResponseBytes: Int
  private let lock = NSLock()
  private var continuation: CheckedContinuation<HTTPResponse, Error>?
  private var completion: Result<HTTPResponse, Error>?
  private var statusCode: Int?
  private var headers: [String: String] = [:]
  private var body = Data()

  init(maximumResponseBytes: Int) {
    self.maximumResponseBytes = maximumResponseBytes
  }

  func install(_ continuation: CheckedContinuation<HTTPResponse, Error>) {
    lock.lock()
    let completed = completion
    if completed == nil {
      self.continuation = continuation
    }
    lock.unlock()
    if let completed {
      continuation.resume(with: completed)
    }
  }

  func fail(_ error: Error) {
    complete(.failure(error))
  }

  func urlSession(
    _ session: URLSession,
    dataTask: URLSessionDataTask,
    didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
  ) {
    guard let response = response as? HTTPURLResponse else {
      complete(.failure(HTTPTransportError.invalidResponse))
      completionHandler(.cancel)
      return
    }
    guard !(300..<400).contains(response.statusCode) else {
      complete(.failure(HTTPTransportError.redirectNotAllowed))
      completionHandler(.cancel)
      return
    }
    if response.expectedContentLength > maximumResponseBytes {
      complete(.failure(HTTPTransportError.responseTooLarge))
      completionHandler(.cancel)
      return
    }

    lock.lock()
    statusCode = response.statusCode
    for (key, value) in response.allHeaderFields {
      let name = String(describing: key).lowercased()
      let value = String(describing: value)
      headers[name] = headers[name].map { "\($0), \(value)" } ?? value
    }
    lock.unlock()
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    lock.lock()
    guard completion == nil else {
      lock.unlock()
      dataTask.cancel()
      return
    }
    guard data.count <= maximumResponseBytes - body.count else {
      lock.unlock()
      complete(.failure(HTTPTransportError.responseTooLarge))
      dataTask.cancel()
      return
    }
    body.append(data)
    lock.unlock()
  }

  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
    complete(.failure(HTTPTransportError.redirectNotAllowed))
    task.cancel()
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    if let error {
      if (error as? URLError)?.code == .timedOut {
        complete(.failure(HTTPTransportError.timedOut))
      } else {
        complete(.failure(error))
      }
      return
    }

    lock.lock()
    let response = statusCode.map {
      HTTPResponse(statusCode: $0, headers: headers, body: body)
    }
    lock.unlock()
    guard let response else {
      complete(.failure(HTTPTransportError.invalidResponse))
      return
    }
    complete(.success(response))
  }

  private func complete(_ result: Result<HTTPResponse, Error>) {
    lock.lock()
    guard completion == nil else {
      lock.unlock()
      return
    }
    completion = result
    let continuation = self.continuation
    self.continuation = nil
    lock.unlock()
    continuation?.resume(with: result)
  }
}
