import HTTPTypes
import OpenAPIRuntime
import Testing

#if canImport(FoundationEssentials)
import FoundationEssentials
#else
import Foundation
#endif

@testable import AgenticDeveloperHubClient

/// Drives `SessionRefreshMiddleware.intercept` directly with a scripted `next`
/// — no transport, no generated client. Each test is one row of the refresh
/// decision table in the middleware's doc comment.
@Suite("SessionRefreshMiddleware")
struct SessionRefreshMiddlewareTests {

    private static let baseURL = URL(string: "https://api.example.invalid")!
    private static let refreshJSON = #"{"token":"jwt-2","refreshToken":"r-2"}"#

    private struct Call: Sendable {
        var path: String
        var authorization: String?
        var body: Data?
    }

    /// Records every call to `next`; answers with `script[callIndex]`.
    private final class Script: @unchecked Sendable {
        private let lock = NSLock()
        private var calls: [Call] = []
        private let responses: [(HTTPResponse.Status, String)]
        init(_ responses: [(HTTPResponse.Status, String)]) { self.responses = responses }
        var recorded: [Call] { lock.withLock { calls } }

        func next(_ request: HTTPRequest, _ body: HTTPBody?, _ baseURL: URL) async throws -> (HTTPResponse, HTTPBody?) {
            var data: Data?
            if let body {
                data = try await Data(collecting: body, upTo: 1 << 20)
            }
            let index = lock.withLock { () -> Int in
                calls.append(Call(path: request.path ?? "", authorization: request.headerFields[.authorization], body: data))
                return calls.count - 1
            }
            let (status, json) = responses[min(index, responses.count - 1)]
            var response = HTTPResponse(status: status)
            response.headerFields[.contentType] = "application/json"
            return (response, HTTPBody(Data(json.utf8)))
        }
    }

    private func jwtStore(refresh: String? = "r-1") -> InMemorySessionStore {
        InMemorySessionStore(Session(credentials: Credentials(token: "jwt-1", kind: .jwt), refreshToken: refresh))
    }

    private func intercept(
        _ middleware: SessionRefreshMiddleware,
        script: Script,
        operationID: String = "getAuthMe",
        body: Data? = nil
    ) async throws -> HTTPResponse {
        let request = HTTPRequest(method: .get, scheme: nil, authority: nil, path: "/auth/me")
        let (response, _) = try await middleware.intercept(
            request,
            body: body.map { HTTPBody($0) },
            baseURL: Self.baseURL,
            operationID: operationID,
            next: script.next
        )
        return response
    }

    @Test("attaches the session bearer and passes a non-401 response through")
    func attachesBearer() async throws {
        let store = jwtStore()
        let script = Script([(.ok, #"{"id":"u1"}"#)])

        let response = try await intercept(SessionRefreshMiddleware(session: store), script: script)

        #expect(response.status == .ok)
        #expect(script.recorded.count == 1)
        #expect(script.recorded[0].authorization == "Bearer jwt-1")
    }

    @Test("no session → no Authorization header, no refresh attempt on 401")
    func noSession() async throws {
        let script = Script([(.unauthorized, "{}")])

        let response = try await intercept(SessionRefreshMiddleware(session: InMemorySessionStore()), script: script)

        #expect(response.status == .unauthorized)
        #expect(script.recorded.count == 1)
        #expect(script.recorded[0].authorization == nil)
    }

    @Test("401 on a JWT session refreshes, saves the rotated session, and retries once with the new bearer")
    func refreshesAndRetries() async throws {
        let store = jwtStore()
        let script = Script([(.unauthorized, "{}"), (.ok, Self.refreshJSON), (.ok, #"{"id":"u1"}"#)])
        let requestBody = Data(#"{"name":"x"}"#.utf8)

        let response = try await intercept(SessionRefreshMiddleware(session: store), script: script, operationID: "patchAuthMe", body: requestBody)

        #expect(response.status == .ok)
        let calls = script.recorded
        #expect(calls.count == 3)
        #expect(calls[1].path == "/auth/refresh")
        #expect(calls[1].authorization == nil)
        #expect(calls[1].body == Data(#"{"refreshToken":"r-1"}"#.utf8))
        #expect(calls[2].path == "/auth/me")
        #expect(calls[2].authorization == "Bearer jwt-2")
        #expect(calls[2].body == requestBody)
        #expect(store.currentSession() == Session(credentials: Credentials(token: "jwt-2", kind: .jwt), refreshToken: "r-2"))
    }

    @Test("a rejected refresh clears the session and reports expiry; the original 401 is returned")
    func rejectedRefreshClears() async throws {
        let store = jwtStore()
        let expired = Box(0)
        let script = Script([(.unauthorized, "{}"), (.unauthorized, #"{"error":"invalid or expired refresh token"}"#)])

        let response = try await intercept(
            SessionRefreshMiddleware(session: store, onSessionExpired: { expired.set(expired.get + 1) }),
            script: script
        )

        #expect(response.status == .unauthorized)
        #expect(script.recorded.count == 2)
        #expect(store.currentSession() == nil)
        #expect(expired.get == 1)
    }

    @Test("an unavailable refresh (5xx) keeps the session and returns the original 401")
    func unavailableRefreshKeepsSession() async throws {
        let store = jwtStore()
        let expired = Box(0)
        let script = Script([(.unauthorized, "{}"), (.serviceUnavailable, "{}")])

        let response = try await intercept(
            SessionRefreshMiddleware(session: store, onSessionExpired: { expired.set(expired.get + 1) }),
            script: script
        )

        #expect(response.status == .unauthorized)
        #expect(store.currentSession()?.credentials.token == "jwt-1")
        #expect(expired.get == 0)
    }

    @Test("a transport error during refresh keeps the session and returns the original 401")
    func throwingRefreshKeepsSession() async throws {
        let store = jwtStore()
        let counter = Box(0)
        let middleware = SessionRefreshMiddleware(session: store)
        let request = HTTPRequest(method: .get, scheme: nil, authority: nil, path: "/auth/me")

        let (response, _) = try await middleware.intercept(request, body: nil, baseURL: Self.baseURL, operationID: "getAuthMe") { req, _, _ in
            counter.set(counter.get + 1)
            if req.path == "/auth/refresh" { throw URLError(.notConnectedToInternet) }
            return (HTTPResponse(status: .unauthorized), nil)
        }

        #expect(response.status == .unauthorized)
        #expect(counter.get == 2)
        #expect(store.currentSession()?.credentials.token == "jwt-1")
    }

    @Test("exempt operations (the login family and refresh itself) never trigger a refresh")
    func exemptOperations() async throws {
        for operationID in ["postAuthLogin", "postAuthRefresh", "postAuthLoginMfa", "postAuthLoginWebauthn", "postOauthSigninExchange"] {
            let store = jwtStore()
            let script = Script([(.unauthorized, "{}")])
            let response = try await intercept(SessionRefreshMiddleware(session: store), script: script, operationID: operationID)
            #expect(response.status == .unauthorized, "\(operationID)")
            #expect(script.recorded.count == 1, "\(operationID)")
            #expect(store.currentSession()?.credentials.token == "jwt-1", "\(operationID)")
        }
    }

    @Test("an API-token session is never refreshed")
    func apiTokenNotRefreshed() async throws {
        let store = InMemorySessionStore(Session(credentials: Credentials(token: "adh_x", kind: .apiToken)))
        let script = Script([(.unauthorized, "{}")])

        let response = try await intercept(SessionRefreshMiddleware(session: store), script: script)

        #expect(response.status == .unauthorized)
        #expect(script.recorded.count == 1)
        #expect(store.currentSession()?.credentials.token == "adh_x")
    }

    @Test("a JWT session without a refresh token is not refreshed")
    func noRefreshTokenNotRefreshed() async throws {
        let store = jwtStore(refresh: nil)
        let script = Script([(.unauthorized, "{}")])

        let response = try await intercept(SessionRefreshMiddleware(session: store), script: script)

        #expect(response.status == .unauthorized)
        #expect(script.recorded.count == 1)
    }

    @Test("concurrent 401s share one refresh")
    func concurrentRefreshesCoalesce() async throws {
        let store = jwtStore()
        let middleware = SessionRefreshMiddleware(session: store)
        let refreshCalls = Box(0)
        let request = HTTPRequest(method: .get, scheme: nil, authority: nil, path: "/auth/me")

        @Sendable func next(_ req: HTTPRequest, _ body: HTTPBody?, _ url: URL) async throws -> (HTTPResponse, HTTPBody?) {
            if req.path == "/auth/refresh" {
                refreshCalls.set(refreshCalls.get + 1)
                try await Task.sleep(for: .milliseconds(50))
                var response = HTTPResponse(status: .ok)
                response.headerFields[.contentType] = "application/json"
                return (response, HTTPBody(Data(Self.refreshJSON.utf8)))
            }
            if req.headerFields[.authorization] == "Bearer jwt-1" {
                return (HTTPResponse(status: .unauthorized), nil)
            }
            return (HTTPResponse(status: .ok), nil)
        }

        async let a = middleware.intercept(request, body: nil, baseURL: Self.baseURL, operationID: "getAuthMe", next: next)
        async let b = middleware.intercept(request, body: nil, baseURL: Self.baseURL, operationID: "getWorkspaces", next: next)
        let (ra, rb) = try await (a.0, b.0)

        #expect(ra.status == .ok)
        #expect(rb.status == .ok)
        #expect(refreshCalls.get == 1)
        #expect(store.currentSession()?.credentials.token == "jwt-2")
    }
}
