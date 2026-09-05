import HTTPTypes
import OpenAPIRuntime

#if canImport(FoundationEssentials)
import FoundationEssentials
#else
import Foundation
#endif

/// Result of one refresh attempt. Only `.rejected` ends the session —
/// `.unavailable` (5xx, transport error) is the backend being unreachable,
/// which must never sign the user out.
public enum SessionRefreshOutcome: Sendable, Equatable {
    case refreshed(Session)
    case rejected
    case unavailable
}

/// Attaches the session's bearer to every request and, when a JWT session
/// gets a 401, rotates it through `POST /auth/refresh` and retries the
/// original request once. Replaces `AuthenticationMiddleware` for callers
/// that hold a `SessionStore`.
///
/// Decision table:
/// - no session → forward unchanged;
/// - non-401 → returned as-is;
/// - 401 on an exempt operation (login family, refresh), an API-token
///   session, or a session with no refresh token → returned as-is;
/// - 401 otherwise → refresh; `.refreshed` retries once with the new bearer,
///   `.rejected` clears the store and calls `onSessionExpired`, `.unavailable`
///   keeps the store; the last two return the original 401.
///
/// Refreshes are serialized by `RefreshCoordinator`: a request that lost the
/// race finds the store already rotated and simply retries.
public struct SessionRefreshMiddleware: ClientMiddleware {

    /// Operations that answer 401 as a normal outcome (wrong password, bad
    /// code, …) — never a reason to rotate the session.
    public static let exemptOperationIDs: Set<String> = [
        "postAuthLogin",
        "postAuthRefresh",
        "postAuthLoginMfa",
        "postAuthLoginWebauthn",
        "postOauthSigninExchange",
    ]

    /// Request bodies are buffered so the retry can resend them. 16 MiB
    /// covers every JSON body the hub sends; uploads go through storage
    /// presigned URLs, not this client.
    static let maxBufferedBody = 16 * 1024 * 1024

    private let session: any SessionStore
    private let onSessionExpired: @Sendable () -> Void
    private let coordinator = RefreshCoordinator()

    public init(session: any SessionStore, onSessionExpired: @escaping @Sendable () -> Void = {}) {
        self.session = session
        self.onSessionExpired = onSessionExpired
    }

    public func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        let current = session.currentSession()
        let bufferedBody: Data? = if let body {
            try await Data(collecting: body, upTo: Self.maxBufferedBody)
        } else {
            nil
        }

        var first = request
        if let token = current?.credentials.token {
            first.headerFields[.authorization] = "Bearer \(token)"
        }
        let (response, responseBody) = try await next(first, bufferedBody.map { HTTPBody($0) }, baseURL)

        guard response.status == .unauthorized,
              !Self.exemptOperationIDs.contains(operationID),
              let current,
              current.credentials.kind == .jwt,
              let refreshToken = current.refreshToken
        else {
            return (response, responseBody)
        }

        let outcome = await coordinator.refresh(
            previousToken: current.credentials.token,
            currentSession: { session.currentSession() },
            perform: { await Self.performRefresh(refreshToken: refreshToken, baseURL: baseURL, next: next) },
            save: { session.save($0) }
        )

        switch outcome {
        case .refreshed(let rotated):
            var retry = request
            retry.headerFields[.authorization] = "Bearer \(rotated.credentials.token)"
            return try await next(retry, bufferedBody.map { HTTPBody($0) }, baseURL)
        case .rejected:
            session.clear()
            onSessionExpired()
            return (response, responseBody)
        case .unavailable:
            return (response, responseBody)
        }
    }

    private struct RefreshRequestBody: Encodable {
        let refreshToken: String
    }

    private struct RefreshResponseBody: Decodable {
        let token: String
        let refreshToken: String
    }

    /// One `POST /auth/refresh` round-trip through `next` (so it rides the
    /// same transport the failing request used — daemon or direct).
    static func performRefresh(
        refreshToken: String,
        baseURL: URL,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async -> SessionRefreshOutcome {
        var request = HTTPRequest(method: .post, scheme: nil, authority: nil, path: "/auth/refresh")
        request.headerFields[.contentType] = "application/json"
        request.headerFields[.accept] = "application/json"
        let body: Data
        do {
            body = try JSONEncoder().encode(RefreshRequestBody(refreshToken: refreshToken))
        } catch {
            return .unavailable
        }
        do {
            let (response, responseBody) = try await next(request, HTTPBody(body), baseURL)
            switch response.status.code {
            case 200:
                let data = try await Data(collecting: responseBody ?? HTTPBody(), upTo: maxBufferedBody)
                let decoded = try JSONDecoder().decode(RefreshResponseBody.self, from: data)
                return .refreshed(Session(
                    credentials: Credentials(token: decoded.token, kind: .jwt),
                    refreshToken: decoded.refreshToken
                ))
            case 401, 403:
                return .rejected
            default:
                return .unavailable
            }
        } catch {
            return .unavailable
        }
    }
}

/// Serializes refreshes. The first caller for a given expired token — the
/// leader — runs `perform` directly, within this actor's own isolation;
/// later callers that arrive while it is in flight — followers — queue on a
/// continuation and receive the leader's outcome instead of spending the
/// (single-use) refresh token a second time. A caller that arrives *after*
/// a refresh has already completed, holding a token the store no longer
/// has, is handed `.refreshed` with the store's current session directly.
///
/// `perform`, `currentSession`, and `save` are deliberately non-escaping:
/// `perform` closes over the middleware's `next`, which
/// `ClientMiddleware.intercept` hands out non-escaping, so the leader must
/// call it in place (`await perform()`) rather than handing it to a
/// `Task { ... }`, which would require it to escape. Running the leader's
/// work as a plain `await` inside this actor method still gives one
/// refresh per wave: Swift only interleaves other calls to this actor at
/// the leader's suspension points, and by its first `await` the leader has
/// already recorded `isRefreshing = true`, so every follower that reaches
/// this method afterward sees it and queues instead of racing to lead.
///
/// The leader saves the rotated session itself (via `save`) *before*
/// resuming any follower's continuation, so a follower released from
/// `await` here always finds the store already rotated.
actor RefreshCoordinator {
    private var isRefreshing = false
    private var waiters: [CheckedContinuation<SessionRefreshOutcome, Never>] = []

    func refresh(
        previousToken: String,
        currentSession: @Sendable () -> Session?,
        perform: @Sendable () async -> SessionRefreshOutcome,
        save: @Sendable (Session) -> Void
    ) async -> SessionRefreshOutcome {
        if isRefreshing {
            return await withCheckedContinuation { waiters.append($0) }
        }
        if let current = currentSession(), current.credentials.token != previousToken {
            return .refreshed(current)
        }
        isRefreshing = true
        let outcome = await perform()
        if case .refreshed(let rotated) = outcome {
            save(rotated)
        }
        isRefreshing = false
        let pending = waiters
        waiters = []
        for waiter in pending {
            waiter.resume(returning: outcome)
        }
        return outcome
    }
}
