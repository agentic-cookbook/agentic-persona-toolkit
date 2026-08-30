import Testing
import AppKit
import Foundation
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

/// Covers `InlineChatView`'s sizing/engagement wiring — amendment 6 of
/// Task 8: `sizing` plus AppKit-side engagement tracking. Kept separate from
/// `InlineChatViewTests.swift`, which must stay unedited and passing: that
/// file never sets `sizing`, so the default `InlineChatSizing()` (no
/// `inactive` configured) must keep reproducing today's fixed-height
/// behaviour exactly, and this suite is where that guarantee — and the new
/// collapse/animate behaviour — gets pinned.
@MainActor
@Suite("InlineChatView sizing")
struct InlineChatViewSizingTests {

    private func makeManager(activeThemeID: String) -> ThemeManager {
        ThemeManager(storage: InMemoryThemeStorage(activeThemeID: activeThemeID))
    }

    private func makeView(localParticipantID: String = "user-1") -> (InlineChatView, ObservableChatViewModel, FakeBackend) {
        let backend = FakeBackend()
        let viewModel = ObservableChatViewModel(backend: backend, localParticipantID: localParticipantID)
        let view = InlineChatView(viewModel: viewModel, localParticipantID: localParticipantID)
        view.frame = NSRect(x: 0, y: 0, width: 400, height: 500)
        view.layoutSubtreeIfNeeded()
        return (view, viewModel, backend)
    }

    @Test("the default sizing (no inactive configured) never tracks engagement, so the transcript stays visible")
    func defaultSizingIsStaticRegardlessOfEngagement() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, _, _) = makeView()

        #expect(view.sizing.resolve(engaged: false).tracksEngagement == false)
        view.engaged = true
        #expect(view.transcriptScroll.isHidden == false)
        view.engaged = false
        #expect(view.transcriptScroll.isHidden == false)
    }

    @Test("inactive: .minimal collapses the transcript when disengaged, and engaging expands it")
    func minimalInactiveCollapsesWhenDisengaged() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, _, _) = makeView()
        view.sizing = InlineChatSizing(active: .fixed, inactive: .minimal, transition: .none)

        // Freshly constructed engagement default is `false`, so an
        // `.minimal` inactive behaviour must already be collapsed.
        #expect(view.transcriptScroll.isHidden == true)

        view.engaged = true
        #expect(view.transcriptScroll.isHidden == false)

        view.engaged = false
        #expect(view.transcriptScroll.isHidden == true)
    }

    @Test("controlTextDidBeginEditing engages the view; controlTextDidEndEditing disengages it")
    func focusInAndOutTrackEngagement() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, _, _) = makeView()
        view.sizing = InlineChatSizing(active: .fixed, inactive: .minimal, transition: .none)
        #expect(view.engaged == false)

        view.controlTextDidBeginEditing(Notification(name: NSControl.textDidBeginEditingNotification))
        #expect(view.engaged == true)

        view.controlTextDidEndEditing(Notification(name: NSControl.textDidEndEditingNotification))
        #expect(view.engaged == false)
    }

    @Test("Escape (cancelOperation) disengages the view")
    func escapeDisengages() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, _, _) = makeView()
        view.sizing = InlineChatSizing(active: .fixed, inactive: .minimal, transition: .none)
        view.engaged = true

        let handled = view.control(
            NSControl(), textView: NSTextView(),
            doCommandBy: #selector(NSResponder.cancelOperation(_:)))

        #expect(handled == true)
        #expect(view.engaged == false)
    }

    @Test("a fixed active behaviour with a points cap resizes the transcript to the cap")
    func contentHuggingPointsCapSetsHeight() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, _, _) = makeView()
        view.sizing = InlineChatSizing(
            active: .contentHugging(maxHeight: .points(120)), inactive: .minimal, transition: .none)
        view.engaged = true
        view.layoutSubtreeIfNeeded()

        #expect(view.transcriptScroll.isHidden == false)
        #expect(view.transcriptHeightConstraint.constant == 120)
    }

    @Test("animates is true only when the transition is .animated and inactive is configured")
    func animatesReflectsResolvedSizing() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, _, _) = makeView()

        view.sizing = InlineChatSizing(active: .fixed, inactive: .minimal, transition: .animated)
        #expect(view.sizing.resolve(engaged: view.engaged).animates == true)

        view.sizing = InlineChatSizing(active: .fixed, inactive: nil, transition: .animated)
        #expect(view.sizing.resolve(engaged: view.engaged).animates == false)
    }
}
