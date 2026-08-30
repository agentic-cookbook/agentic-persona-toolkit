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

    @Test("shows a ThinkingIndicatorView while a participant is typing, and removes it once typing stops")
    func showsThinkingIndicatorWhileTyping() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (view, viewModel, _) = makeView()
        let stack = transcriptStack(of: view)

        viewModel.handle(.typing(participantID: "persona-1", isTyping: true))
        #expect(stack?.arrangedSubviews.contains { $0 is ThinkingIndicatorView } == true)

        viewModel.handle(.typing(participantID: "persona-1", isTyping: false))
        #expect(stack?.arrangedSubviews.contains { $0 is ThinkingIndicatorView } == false)
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
