import Testing

#if canImport(FoundationEssentials)
import FoundationEssentials
#else
import Foundation
#endif

@testable import AgenticDeveloperHubClient

@Suite("Session stores")
struct SessionStoreTests {

    @Test("in-memory store round-trips a session and exposes its credentials")
    func inMemoryRoundTrip() {
        let store = InMemorySessionStore()
        #expect(store.currentSession() == nil)
        #expect(store.currentCredentials() == nil)

        let session = Session(credentials: Credentials(token: "jwt-1", kind: .jwt), refreshToken: "r-1")
        store.save(session)

        #expect(store.currentSession() == session)
        #expect(store.currentCredentials() == Credentials(token: "jwt-1", kind: .jwt))
    }

    @Test("saving bare credentials drops any refresh token (an API token has none)")
    func saveCredentialsDropsRefreshToken() {
        let store = InMemorySessionStore(Session(credentials: Credentials(token: "jwt-1", kind: .jwt), refreshToken: "r-1"))

        store.save(Credentials(token: "adh_secret", kind: .apiToken))

        #expect(store.currentSession() == Session(credentials: Credentials(token: "adh_secret", kind: .apiToken), refreshToken: nil))
    }

    @Test("clear removes the whole session")
    func clearRemovesSession() {
        let store = InMemorySessionStore(Session(credentials: Credentials(token: "jwt-1", kind: .jwt), refreshToken: "r-1"))

        store.clear()

        #expect(store.currentSession() == nil)
        #expect(store.currentCredentials() == nil)
    }

    @Test("a session store is usable wherever a CredentialProvider is expected")
    func isACredentialProvider() {
        let store: any CredentialProvider = InMemorySessionStore(Session(credentials: Credentials(token: "t", kind: .jwt)))
        #expect(store.currentCredentials()?.token == "t")
    }

    @Test("keychain store derives its three keys from the prefix")
    func keychainKeys() {
        let store = KeychainSessionStore(keyPrefix: "adh.test")
        #expect(store.tokenKey == "adh.test.token")
        #expect(store.kindKey == "adh.test.token.kind")
        #expect(store.refreshKey == "adh.test.refresh")
    }
}
