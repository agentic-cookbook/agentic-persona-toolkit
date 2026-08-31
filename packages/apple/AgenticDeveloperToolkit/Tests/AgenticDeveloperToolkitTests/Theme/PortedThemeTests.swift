import Testing
import Foundation
@testable import AgenticDeveloperToolkit

@Suite("Ported web themes")
struct PortedThemeTests {

    /// Names are the manifest's own labels, verbatim — four of them do not
    /// match the obvious guess, so copy from here rather than inventing:
    /// "Green Matrix (Glass)" is parenthesised, "Synthwave '84" carries an
    /// apostrophe, and Projects Overview / Agentic Cookbook have no trailing
    /// "My" or "Web".
    @Test("every web theme Swift is missing has been ported")
    func catalogMatchesWeb() {
        let expected: Set<String> = [
            "Charcoal", "Signal", "Terminal", "Terminal Split", "Green Matrix",
            "Green Matrix (Glass)", "Old School Terminal", "CRT Monitor",
            "Handheld Communicator", "Synthwave '84", "Cobalt2", "Vesper",
            "Professional", "Techy", "Whimsical", "Fishlamp", "Dev Team",
            "Mike Fullerton", "My Projects", "Projects Overview",
            "Agentic Cookbook",
        ]
        let names = Set(BuiltInThemes.webPorted.map(\.name))
        #expect(names == expected)
    }

    /// The web manifest has 39 keys; only these 21 get ported. The other 18
    /// are deliberately out:
    ///
    /// - Ten are editor palettes Swift already ships — dracula, nord, gruvbox,
    ///   solarized, catppuccin, github, monokai, one-dark, tokyo-night, rose-pine.
    ///   Swift splits several into light and dark variants where web has one
    ///   key; that difference predates this branch and is not ours to
    ///   reconcile here.
    /// - Eight are the `adh*` font-variant family, which share one palette and
    ///   differ only in `--font-*`. Typography variants are a web font-loading
    ///   concern with no Swift analogue.
    @Test("the themes Swift already has are not ported twice")
    func noDuplicateNames() {
        let existing = Set(BuiltInThemes.all.map(\.name))
            .subtracting(BuiltInThemes.webPorted.map(\.name))
        for ported in BuiltInThemes.webPorted {
            #expect(!existing.contains(ported.name), "\(ported.name) already exists")
        }
        #expect(Set(BuiltInThemes.all.map(\.id)).count == BuiltInThemes.all.count)
    }

    @Test("every ported theme has a structurally valid palette")
    func palettesAreValid() {
        for theme in BuiltInThemes.webPorted {
            #expect(theme.hasValidPalette, "\(theme.name) has \(theme.ansi.count) ANSI colours")
            #expect(theme.isBuiltIn)
        }
    }

    /// Only the nine chat properties every web theme defines are required.
    /// The bubble *borders* and the send-button roles are NOT among them —
    /// they exist in some themes and derive in the rest. (The bubble fills
    /// are always present now, but as an explicit transparency where web
    /// declares none; see `themesWithoutWebBubbleFillsAreFlat`.)
    @Test("ported themes carry the web chat colours that exist")
    func chatOverridesArePresent() {
        let universal: [ThemeRole] = [
            .chatSurface, .chatInputBackground, .chatInputBorder, .chatInputFocus,
            .personaName, .personaText, .userName, .userText, .timestampText,
        ]
        for theme in BuiltInThemes.webPorted {
            for role in universal {
                #expect(
                    theme.roleOverrides[role.rawValue] != nil,
                    "\(theme.name) is missing an override for \(role)"
                )
            }
        }
    }

    /// The seven flat terminal themes — the ones whose CSS declares no
    /// `--pc-persona-bg` / `--pc-user-bg` — must resolve both fills fully
    /// transparent, so `MessageBubbleView` drops the padding and the corner
    /// radius and draws a plain transcript line.
    ///
    /// This inverts what this suite used to assert. The old rule ("the derive
    /// rules must invent a *visible* bubble") was reasoning about the port in
    /// isolation; against the web page it is simply wrong. `.pc-bubble` in
    /// `packages/web/packages/chat/src/css/base.css` sets `width`,
    /// `max-width`, `min-width`, `word-wrap` and `position` and nothing else,
    /// so a web theme that names no fill renders no box. Deriving one gave
    /// `old-school-terminal` a grey slab the website has never drawn.
    @Test("themes without web bubble fills are flat, not derived")
    func themesWithoutWebBubbleFillsAreFlat() {
        let flat: Set<String> = [
            "Terminal", "Terminal Split", "Green Matrix", "Green Matrix (Glass)",
            "Old School Terminal", "CRT Monitor", "Handheld Communicator",
        ]
        var seen: Set<String> = []
        for theme in BuiltInThemes.webPorted {
            let palette = SemanticPalette(theme: theme)
            let isFlat = palette.color(.personaBubble).alpha == 0
                && palette.color(.userBubble).alpha == 0
            if isFlat { seen.insert(theme.name) }
        }
        #expect(seen == flat)
    }

    /// Every ported theme carries web's font stack, reduced to the two things
    /// `FontStyle` can hold: the first named family and whether the stack is
    /// monospaced. An uninstalled family is not a defect — `VT323` is a web
    /// font and almost certainly absent — because `nsFont(scaledSize:)` falls
    /// through to the system face, which is what the browser does with the
    /// same stack's `ui-monospace` fallback.
    @Test("ported themes carry web's typography")
    func typographyIsPorted() {
        for theme in BuiltInThemes.webPorted {
            for role in TextRole.allCases {
                #expect(
                    theme.typography.styles[role.rawValue] != nil,
                    "\(theme.name) has no style for \(role)"
                )
            }
        }
        let terminal = BuiltInThemes.webPorted.first { $0.name == "Old School Terminal" }!
        #expect(terminal.typography.style(.body).family == "VT323")
        #expect(terminal.typography.style(.body).monospaced)

        // A sans theme keeps its face and is *not* forced monospaced — the
        // flag comes from the stack's own generic fallback, not from a guess.
        let professional = BuiltInThemes.webPorted.first { $0.name == "Professional" }!
        #expect(professional.typography.style(.body).family == "Inter")
        #expect(!professional.typography.style(.body).monospaced)
        #expect(professional.typography.style(.code).family == "JetBrains Mono")
        #expect(professional.typography.style(.code).monospaced)
    }

    @Test("ported themes are in the catalog")
    func foldedIntoAll() {
        for theme in BuiltInThemes.webPorted {
            #expect(BuiltInThemes.all.contains { $0.id == theme.id })
        }
    }
}
