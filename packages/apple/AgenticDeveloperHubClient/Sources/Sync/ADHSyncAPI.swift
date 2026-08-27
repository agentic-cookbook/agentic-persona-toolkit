#if canImport(FoundationEssentials)
import FoundationEssentials
#else
import Foundation
#endif

/// Authenticated wire client for the backend's offline-sync endpoints.
///
/// Deliberately decodes NOTHING: the wire shapes are owned by the backend and
/// by the native sync core; this type only owns URLs, auth, and HTTP error
/// mapping, so this package needs no sync-core dependency. Hosts adapt it to
/// SyncTransport in ~20 lines.
public struct ADHSyncAPI: Sendable {

    public enum Failure: Error, Sendable, Equatable {
        case unauthorized
        case resyncRequired
        case http(Int)
        case transport(String)
    }

    private let baseURL: URL
    private let credentials: any CredentialProvider
    private let session: URLSession

    public init(
        baseURL: URL = DaemonContract.backendURL,
        credentials: any CredentialProvider,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.credentials = credentials
        self.session = session
    }

    /// GET /sync/pull?cursor=&limit= — returns the raw response body.
    public func pull(cursor: String?, limit: Int) async throws -> Data {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("sync/pull"),
            resolvingAgainstBaseURL: false
        )!
        var query = [URLQueryItem(name: "limit", value: String(limit))]
        if let cursor {
            query.insert(URLQueryItem(name: "cursor", value: cursor), at: 0)
        }
        components.queryItems = query
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        return try await perform(request)
    }

    /// POST /sync/push with a pre-encoded SyncPushRequest body.
    public func push(body: Data) async throws -> Data {
        var request = URLRequest(url: baseURL.appendingPathComponent("sync/push"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        return try await perform(request)
    }

    private func perform(_ request: URLRequest) async throws -> Data {
        var request = request
        if let token = credentials.currentCredentials()?.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw Failure.transport(String(describing: error))
        }
        guard let http = response as? HTTPURLResponse else {
            throw Failure.transport("non-HTTP response")
        }
        switch http.statusCode {
        case 200...299: return data
        case 401: throw Failure.unauthorized
        case 410: throw Failure.resyncRequired
        default: throw Failure.http(http.statusCode)
        }
    }
}
