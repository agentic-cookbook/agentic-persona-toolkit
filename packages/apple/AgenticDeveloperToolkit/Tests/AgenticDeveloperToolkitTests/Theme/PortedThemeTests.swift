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
    /// The bubble fills are NOT among them — `--pc-persona-bg` and friends
    /// exist in 14 of the 21, and the rest are meant to derive. Asserting them
    /// here would force seven themes to invent colours the web never gave them.
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

    /// The seven themes without web bubble fills must still render a bubble
    /// distinguishable from the transcript behind it — that is the derive
    /// rules doing their job, and it is the reason they are allowed to be
    /// absent above.
    @Test("themes without web bubble fills still derive a visible bubble")
    func derivedBubblesAreVisible() {
        for theme in BuiltInThemes.webPorted
        where theme.roleOverrides[ThemeRole.personaBubble.rawValue] == nil {
            let palette = SemanticPalette(theme: theme)
            #expect(
                palette.color(.personaBubble) != palette.color(.chatSurface),
                "\(theme.name): the persona bubble vanishes into the transcript"
            )
        }
    }

    @Test("ported themes are in the catalog")
    func foldedIntoAll() {
        for theme in BuiltInThemes.webPorted {
            #expect(BuiltInThemes.all.contains { $0.id == theme.id })
        }
    }
}
