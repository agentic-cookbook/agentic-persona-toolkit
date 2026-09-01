import Testing
import AppKit
import Foundation
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

@MainActor
@Suite("InlineChatView")
struct InlineChatViewTests {

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

    private func transcriptStack(of view: InlineChatView) -> NSStackView? {
        guard let scrollView = view.subviews.compactMap({ $0 as? NSScrollView }).first else { return nil }
        return scrollView.documentView as? NSStackView
    }

    @Test("constructs with an empty transcript and a scroll view hosting it")
    func constructsEmpty() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, _, _) = makeView()
        let stack = transcriptStack(of: view)
        #expect(stack != nil)
        #expect(stack?.arrangedSubviews.isEmpty == true)
    }

    @Test("adds itself as an observer, so a new message rebuilds the transcript with a bubble")
    func rebuildsOnMessagesChanged() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, viewModel, _) = makeView()
        let stack = transcriptStack(of: view)

        viewModel.handle(.messageReceived(FixtureMessage(
            id: "1", localID: "1", senderID: "persona-1", text: "hi there", timestamp: Date())))

        #expect(stack?.arrangedSubviews.count == 1)
        #expect(stack?.arrangedSubviews.first is MessageBubbleView)
    }

    /// The indicator is a permanent fixture of the status row above the
    /// composer, not a transcript entry that appears and disappears.
    ///
    /// It used to be appended to the transcript stack and thrown away on the
    /// next rebuild — which is why the phase machine never advanced past its
    /// first frame, and why nobody ever saw a word change from "fleeping…" to
    /// "flooping…". One long-lived view keeps the phase, the shuffle bag and
    /// the frame timer alive across every update; typing just drives it.
    @Test("typing drives the persistent status line, not a transcript entry")
    func typingDrivesThePersistentStatusLine() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, viewModel, _) = makeView()

        var configuration = ThinkingIndicatorConfiguration()
        configuration.words = [ChatStatusWordPair(present: "fleeping", past: "fleeped")]
        view.thinkingIndicator.configure(configuration)

        #expect(view.thinkingIndicator.superview != nil)
        #expect(view.thinkingIndicator.currentPhase == .idle)

        viewModel.handle(.typing(participantID: "persona-1", isTyping: true))
        #expect(view.thinkingIndicator.currentPhase == .thinking)
        #expect(view.thinkingIndicator.label.stringValue.contains("fleeping"))
        // Never in the transcript: a status line that scrolled away with the
        // messages would be gone the moment the reply it describes arrives.
        #expect(transcriptStack(of: view)?.arrangedSubviews.contains { $0 is ThinkingIndicatorView } == false)

        viewModel.handle(.typing(participantID: "persona-1", isTyping: false))
        #expect(view.thinkingIndicator.currentPhase == .done)
        #expect(view.thinkingIndicator.label.stringValue.contains("fleeped"))
    }

    @Test("renders an in-progress draft as a bubble")
    func rendersActiveDraftAsBubble() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, viewModel, _) = makeView()
        let stack = transcriptStack(of: view)

        viewModel.handle(.draftUpdated(participantID: "persona-1", text: "Hel", attachments: []))
        #expect(stack?.arrangedSubviews.count == 1)

        // The replace-not-append invariant should also hold end-to-end
        // through the bound view: a second update still renders one bubble.
        viewModel.handle(.draftUpdated(participantID: "persona-1", text: "Hello", attachments: []))
        #expect(stack?.arrangedSubviews.count == 1)
    }

    @Test("an invoked command adds a pill, and its result updates that same pill in place")
    func rendersCommandActivityAsPill() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let palette = ThemePaletteObserver.currentPalette
        let (view, viewModel, _) = makeView()
        let stack = transcriptStack(of: view)
        let invocation = FixtureCommandInvocation(id: "inv-1", commandName: "grep", invokerID: "persona-1")

        viewModel.handle(.commandInvoked(participantID: "persona-1", invocation: invocation))
        let pills = { stack?.arrangedSubviews.compactMap { $0 as? ToolCallPillView } ?? [] }
        #expect(pills().count == 1)
        #expect(pills().first?.titleColor == palette.nsColor(.info))

        viewModel.handle(.commandCompleted(
            participantID: "persona-1",
            result: FixtureCommandResult(invocationID: "inv-1", ok: true)))
        #expect(pills().count == 1)
        #expect(pills().first?.titleColor == palette.nsColor(.success))
    }

    @Test("a deallocated view stops observing — a further update does not crash")
    func deallocatedViewStopsObserving() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let backend = FakeBackend()
        let viewModel = ObservableChatViewModel(backend: backend, localParticipantID: "user-1")
        do {
            let view = InlineChatView(viewModel: viewModel, localParticipantID: "user-1")
            view.frame = NSRect(x: 0, y: 0, width: 400, height: 500)
            view.layoutSubtreeIfNeeded()
        }
        // `view` has deallocated without unregistering itself: `deinit` is
        // nonisolated and cannot call the `@MainActor` `removeObserver`. The
        // weak observer table is what makes that safe, so this is the test
        // that the table really is weak -- a strong one would either keep the
        // view alive or leave a dangling entry for `notify` to message.
        viewModel.handle(.messageReceived(FixtureMessage(
            id: "1", localID: "1", senderID: "persona-1", text: "hi", timestamp: Date())))
    }

    // MARK: Chrome

    /// The composer is where a theme's terminal-ness is most visible and where
    /// the port had been least faithful: web's `.pc-input` sets
    /// `border: none`, draws a `❯` as the input row's `::before`, and replaces
    /// the native caret with a blinking phosphor block. None of that is a
    /// colour, so all of it lives on `chrome`.
    @Test("terminal chrome unboxes the composer and gives it a prompt")
    func terminalChromeShapesTheComposer() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, _, _) = makeView()

        // The default is the boxed, rounded, prompt-less composer every
        // non-terminal theme wants — asserted so the terminal case below is
        // read as a change and not as the only behaviour.
        #expect(view.inputField.showsBorder)
        #expect(!view.inputField.usesBlockCaret)
        #expect(view.promptLabel.isHidden)

        view.chrome = .terminal
        #expect(!view.inputField.showsBorder)
        #expect(view.inputField.layer?.borderWidth == 0)
        #expect(view.inputField.usesBlockCaret)
        #expect(!view.promptLabel.isHidden)
        #expect(view.promptLabel.stringValue == "\u{276F}")
        #expect(view.inputField.cornerRadius == 0)
    }

    /// The prompt is the composer's own ink — web colours it with the input's
    /// text colour — so it has to follow the theme like everything else.
    @Test("the prompt repaints with the active theme")
    func promptRepaintsOnThemeChange() {
        let manager = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, _, _) = makeView()
        view.chrome = .terminal

        let before = view.promptLabel.textColor
        manager.selectTheme(id: BuiltInThemes.dracula.id)
        pumpRunLoop()

        #expect(before != nil)
        #expect(before != view.promptLabel.textColor)
    }

    // MARK: The surface

    /// Web paints `--pc-surface` on `.persona-chat` and nowhere else:
    /// `.pc-transcript`, `.pc-typing` and `.pc-input-area` declare no
    /// `background` at all. The port had each of them repaint it, which costs
    /// nothing while the surface is opaque and is plainly visible the moment
    /// it is not — `old-school-terminal` sets `rgba(5, 8, 5, 0.8)`, and three
    /// stacked copies of an 80% fill drew the transcript nearly solid while
    /// the status row and the composer stayed see-through.
    ///
    /// It is also what makes a translucent theme translucent *as a window*:
    /// the host clears the window's own fill, so whatever alpha survives this
    /// one layer is what the desktop shows through.
    @Test("only the chat view itself paints the surface")
    func theSurfaceIsPaintedExactlyOnce() throws {
        let terminal = try #require(BuiltInThemes.all.first { $0.name == "Old School Terminal" })
        let manager = makeManager(activeThemeID: terminal.id)
        let palette = manager.currentPalette
        let (view, _, _) = makeView()

        // The theme really is translucent — the rest of the test is only
        // interesting because of this.
        #expect(palette.color(.chatSurface).alpha < 1)
        #expect(view.layer?.backgroundColor == palette.nsColor(.chatSurface).cgColor)

        let scroll = try #require(view.subviews.compactMap { $0 as? NSScrollView }.first)
        #expect(!scroll.drawsBackground)
        #expect(!scroll.contentView.drawsBackground)
        #expect(view.thinkingIndicator.layer?.backgroundColor == NSColor.clear.cgColor)
        let statusRow = try #require(view.thinkingIndicator.superview)
        #expect(statusRow.layer?.backgroundColor == NSColor.clear.cgColor)
        withExtendedLifetime(manager) {}
    }

    @Test("repaints its layer background when the active theme changes")
    func repaintsOnThemeChange() {
        let manager = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, _, _) = makeView()

        let before = view.layer?.backgroundColor
        manager.selectTheme(id: BuiltInThemes.dracula.id)
        pumpRunLoop()
        let after = view.layer?.backgroundColor

        #expect(before != nil)
        #expect(before != after)
    }
}
