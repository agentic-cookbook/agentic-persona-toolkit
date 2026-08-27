import Foundation
import Security
import os

/// Simple CRUD over macOS Keychain generic-password items, scoped to a
/// configurable service identifier.
///
/// Vendored from an internal `KeychainHelper`, with the `Loggable`
/// dependency dropped so this module stays dependency-free.
public enum KeychainHelper {

    /// The Keychain service identifier. Defaults to the main bundle identifier.
    nonisolated(unsafe) public static var service: String =
        Bundle.main.bundleIdentifier ?? "com.mikefullerton.AgenticDeveloperHubClient"

    private static let logger = Logger(
        subsystem: "com.mikefullerton.AgenticDeveloperHubClient",
        category: "Keychain"
    )

    /// Stores a value for the given account key, overwriting any existing value.
    ///
    /// On iOS the item is stored with an explicit accessibility class,
    /// `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`: `AfterFirstUnlock`
    /// (not `WhenUnlocked`, the implicit default) because background refresh
    /// must be able to read the token while the device is locked after its
    /// first unlock, and `ThisDeviceOnly` because a bearer token should never
    /// ride device backups or keychain sync onto another device. Because this
    /// method always deletes-then-adds, an existing item picks up the class
    /// on its next save — no separate migration step.
    ///
    /// macOS is deliberately left on the implicit default: the file-based
    /// legacy keychain ignores (and in some OS versions rejects with
    /// `errSecParam`) `kSecAttrAccessible` unless the item also opts into the
    /// data-protection keychain via `kSecUseDataProtectionKeychain` — and
    /// flipping that would strand items existing callers already stored in
    /// the legacy keychain (reads scoped to one keychain no longer see the
    /// other). That migration is a separate decision, not a side effect to
    /// take here.
    @discardableResult
    public static func set(_ value: String, forKey key: String) -> Bool {
        let data = Data(value.utf8)
        delete(forKey: key)

        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
        ]
        #if os(iOS)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        #endif

        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            logger.error("Keychain set failed for '\(key, privacy: .public)': \(status)")
        }
        return status == errSecSuccess
    }

    /// Retrieves the value for the given account key, if present.
    public static func get(forKey key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            if status != errSecItemNotFound {
                logger.error("Keychain get failed for '\(key, privacy: .public)': \(status)")
            }
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    /// Deletes the item for the given account key.
    @discardableResult
    public static func delete(forKey key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]

        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    /// Whether a value exists for the given key.
    public static func exists(forKey key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        return SecItemCopyMatching(query as CFDictionary, nil) == errSecSuccess
    }
}
