import Foundation

/// What a signed-in native app holds: the bearer credential the client sends
/// on every request plus, for password/MFA/passkey/OAuth sign-ins, the
/// single-use refresh token `POST /auth/refresh` rotates. API-token sessions
/// have no refresh token (`refreshToken == nil`) and are never refreshed.
public struct Session: Sendable, Equatable, Codable {
    public var credentials: Credentials
    public var refreshToken: String?

    public init(credentials: Credentials, refreshToken: String? = nil) {
        self.credentials = credentials
        self.refreshToken = refreshToken
    }
}
