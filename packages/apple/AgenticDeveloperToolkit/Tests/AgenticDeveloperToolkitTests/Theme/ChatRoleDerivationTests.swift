import Testing
import Foundation
@testable import AgenticDeveloperToolkit

@Suite("Chat role derivation")
struct ChatRoleDerivationTests {

    /// Every built-in theme must produce legible chat text on its own bubble.
    /// 3.0 is the large-text floor; bubble text is 13pt so this is the honest
    /// minimum, and it is the guard against a mis-transcribed ported theme.
    @Test("chat text contrasts against its own bubble in every built-in theme")
    func chatTextIsLegible() {
        for theme in BuiltInThemes.all {
            let palette = SemanticPalette(theme: theme)
            let pairs: [(ThemeRole, ThemeRole)] = [
                (.personaText, .personaBubble),
                (.userText, .userBubble),
                (.sendButtonText, .sendButton),
            ]
            for (text, fill) in pairs {
                let ratio = palette.color(text).contrastRatio(against: palette.color(fill))
                #expect(ratio >= 3.0, "\(theme.name): \(text) on \(fill) is \(ratio)")
            }
        }
    }

    @Test("a role override wins over the derived chat colour")
    func overrideWins() {
        var theme = BuiltInThemes.all[0]
        let hotPink = RGBAColor(red: 1, green: 0, blue: 0.5, alpha: 1)
        theme.roleOverrides[ThemeRole.userBubble.rawValue] = hotPink
        #expect(SemanticPalette(theme: theme).color(.userBubble) == hotPink)
    }

    @Test("every chat role resolves for every built-in theme")
    func allChatRolesResolve() {
        let chatRoles: [ThemeRole] = [
            .personaBubble, .personaBubbleBorder, .personaText, .personaName,
            .userBubble, .userBubbleBorder, .userText, .userName,
            .chatSurface, .chatInputBackground, .chatInputBorder, .chatInputFocus,
            .sendButton, .sendButtonText, .sendButtonHover, .timestampText,
        ]
        #expect(chatRoles.count == 16)
        for theme in BuiltInThemes.all {
            let palette = SemanticPalette(theme: theme)
            for role in chatRoles {
                #expect(palette.color(role).alpha > 0, "\(theme.name)/\(role) is transparent")
            }
        }
    }
}
