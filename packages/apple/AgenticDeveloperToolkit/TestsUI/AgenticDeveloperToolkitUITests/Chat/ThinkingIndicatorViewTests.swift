import Testing
import AppKit
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

@MainActor
@Suite("ThinkingIndicatorView")
struct ThinkingIndicatorViewTests {

    private func makeManager(activeThemeID: String) -> ThemeManager {
        ThemeManager(storage: InMemoryThemeStorage(activeThemeID: activeThemeID))
    }

    @Test("constructs, lays out, and can start/stop animating without crashing")
    func constructsAndAnimates() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let indicator = ThinkingIndicatorView()
        indicator.frame = NSRect(x: 0, y: 0, width: 48, height: 28)
        indicator.layoutSubtreeIfNeeded()
        indicator.startAnimating()
        indicator.stopAnimating()
        #expect(indicator.frame.width == 48)
    }

    @Test("repaints its layer background when the active theme changes")
    func repaintsOnThemeChange() {
        let manager = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let indicator = ThinkingIndicatorView()

        let before = indicator.layer?.backgroundColor
        manager.selectTheme(id: BuiltInThemes.dracula.id)
        pumpRunLoop()
        let after = indicator.layer?.backgroundColor

        #expect(before != nil)
        #expect(before != after)
    }

    // MARK: Words-empty fallback (ci-thinking-dots-fallback)

    @Test("with no vocabulary configured, update(status:) drives only the dot pulse and never runs a phase machine")
    func fallsBackToDotsWhenWordsIsEmpty() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let indicator = ThinkingIndicatorView()

        // Default configuration: words is empty.
        #expect(indicator.currentPhase == nil)

        indicator.update(status: ChatStatus(kind: .think))
        // Still nil — a non-nil status never engages ThinkingPhase.Machine
        // while no vocabulary is configured. If this wiring were removed
        // (e.g. `update(status:)` always built a Machine regardless of
        // `configuration.words`), this would flip to `.thinking` and fail.
        #expect(indicator.currentPhase == nil)
        #expect(indicator.label.isHidden)

        indicator.update(status: nil)
        #expect(indicator.currentPhase == nil)
    }

    // MARK: Phase-driven line (vocabulary configured)

    @Test("shows a configured word while thinking, then settles to a frozen 'thought for Ns' line")
    func showsWordThenSettles() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let indicator = ThinkingIndicatorView()
        var configuration = ThinkingIndicatorConfiguration()
        configuration.words = [ChatStatusWordPair(present: "zeeping", past: "zeeped")]
        indicator.configure(configuration)

        // Fails if `configure(_:)`/`update(status:)` stop wiring the
        // ShuffleBag and ThinkingPhase.Machine into the label.
        indicator.update(status: ChatStatus(kind: .think))
        #expect(indicator.currentPhase == .thinking)
        #expect(indicator.label.stringValue.contains("zeeping"))
        #expect(!indicator.label.isHidden)

        indicator.update(status: nil)
        #expect(indicator.currentPhase == .done)
        #expect(indicator.label.stringValue.contains("zeeped"))
        #expect(indicator.label.stringValue.contains("for"))
    }

    @Test("repaints the phase-driven line's colours when the active theme changes")
    func repaintsPhaseLineOnThemeChange() {
        let manager = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let indicator = ThinkingIndicatorView()
        var configuration = ThinkingIndicatorConfiguration()
        configuration.words = [ChatStatusWordPair(present: "zeeping", past: "zeeped")]
        indicator.configure(configuration)
        indicator.update(status: ChatStatus(kind: .think))
        indicator.update(status: nil) // settles to .done — colours come from .timestampText

        func renderedColor() -> NSColor? {
            let attributed = indicator.label.attributedStringValue
            guard attributed.length > 0 else { return nil }
            return attributed.attribute(.foregroundColor, at: 0, effectiveRange: nil) as? NSColor
        }

        let before = renderedColor()
        manager.selectTheme(id: BuiltInThemes.dracula.id)
        pumpRunLoop()
        let after = renderedColor()

        // Fails if the label stops being repainted on `ThemeManager`'s
        // notification — exactly the class of bug ci-reactivity-is-behaviour
        // calls out: a green build with the wiring silently dropped.
        #expect(before != nil)
        #expect(before != after)
    }

    @Test("colorful's hue draws never land in the excluded green band")
    func colorfulHueSkipsGreen() {
        for _ in 0..<500 {
            let hue = randomNonGreenHue()
            #expect(hue < 75 || hue >= 165, "hue \(hue) is in the excluded green band")
        }
    }
}
