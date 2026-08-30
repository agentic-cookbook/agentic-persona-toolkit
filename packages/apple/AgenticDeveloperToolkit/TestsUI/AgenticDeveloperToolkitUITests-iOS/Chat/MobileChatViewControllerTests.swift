import Testing
import UIKit
import Foundation
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

@MainActor
@Suite("MobileChatViewController")
struct MobileChatViewControllerTests {

    private func makeManager(activeThemeID: String) -> ThemeManager {
        ThemeManager(storage: InMemoryThemeStorage(activeThemeID: activeThemeID), appearanceDriver: nil)
    }

    private func makeController(
        localParticipantID: String = "user-1"
    ) -> (MobileChatViewController, ObservableChatViewModel, FakeBackend) {
        let backend = FakeBackend()
        let viewModel = ObservableChatViewModel(backend: backend, localParticipantID: localParticipantID)
        let controller = MobileChatViewController(viewModel: viewModel, localParticipantID: localParticipantID)
        controller.loadViewIfNeeded()
        controller.view.frame = CGRect(x: 0, y: 0, width: 400, height: 500)
        controller.view.layoutIfNeeded()
        return (controller, viewModel, backend)
    }

    private func transcriptStack(of controller: MobileChatViewController) -> UIStackView? {
        guard let scrollView = controller.view.subviews.compactMap({ $0 as? UIScrollView }).first else { return nil }
        return scrollView.subviews.compactMap { $0 as? UIStackView }.first
    }

    @Test("constructs with an empty transcript and a scroll view hosting it")
    func constructsEmpty() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (controller, _, _) = makeController()
        let stack = transcriptStack(of: controller)
        #expect(stack != nil)
        #expect(stack?.arrangedSubviews.isEmpty == true)
    }

    @Test("adds itself as an observer, so a new message rebuilds the transcript with a bubble")
    func rebuildsOnMessagesChanged() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (controller, viewModel, _) = makeController()
        let stack = transcriptStack(of: controller)

        viewModel.handle(.messageReceived(FixtureMessage(
            id: "1", localID: "1", senderID: "persona-1", text: "hi there", timestamp: Date())))

        #expect(stack?.arrangedSubviews.count == 1)
        #expect(stack?.arrangedSubviews.first is MobileMessageBubbleView)
    }

    @Test("shows a MobileThinkingIndicatorView while a participant is typing, and removes it once typing stops")
    func showsThinkingIndicatorWhileTyping() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (controller, viewModel, _) = makeController()
        let stack = transcriptStack(of: controller)

        viewModel.handle(.typing(participantID: "persona-1", isTyping: true))
        #expect(stack?.arrangedSubviews.contains { $0 is MobileThinkingIndicatorView } == true)

        viewModel.handle(.typing(participantID: "persona-1", isTyping: false))
        #expect(stack?.arrangedSubviews.contains { $0 is MobileThinkingIndicatorView } == false)
    }

    @Test("renders an in-progress draft as a bubble")
    func rendersActiveDraftAsBubble() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (controller, viewModel, _) = makeController()
        let stack = transcriptStack(of: controller)

        viewModel.handle(.draftUpdated(participantID: "persona-1", text: "Hel", attachments: []))
        #expect(stack?.arrangedSubviews.count == 1)

        // The replace-not-append invariant should also hold end-to-end
        // through the bound controller: a second update still renders one bubble.
        viewModel.handle(.draftUpdated(participantID: "persona-1", text: "Hello", attachments: []))
        #expect(stack?.arrangedSubviews.count == 1)
    }

    @Test("a deallocated controller stops observing — a further update does not crash")
    func deallocatedControllerStopsObserving() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let backend = FakeBackend()
        let viewModel = ObservableChatViewModel(backend: backend, localParticipantID: "user-1")
        do {
            let controller = MobileChatViewController(viewModel: viewModel, localParticipantID: "user-1")
            controller.loadViewIfNeeded()
            controller.view.frame = CGRect(x: 0, y: 0, width: 400, height: 500)
            controller.view.layoutIfNeeded()
        }
        // `controller` has deallocated without unregistering itself:
        // `deinit` is nonisolated and cannot call the `@MainActor`
        // `removeObserver`. The weak observer table is what makes that
        // safe, mirroring `InlineChatViewTests`' identical test.
        viewModel.handle(.messageReceived(FixtureMessage(
            id: "1", localID: "1", senderID: "persona-1", text: "hi", timestamp: Date())))
    }

    @Test("repaints its background when the active theme changes")
    func repaintsOnThemeChange() {
        let manager = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (controller, _, _) = makeController()

        let before = controller.view.backgroundColor
        manager.selectTheme(id: BuiltInThemes.dracula.id)
        pumpRunLoop()
        let after = controller.view.backgroundColor

        #expect(before != nil)
        #expect(before != after)
    }

    // MARK: Open / close

    @Test("open(animated: false) marks the surface open; close(animated: false) marks it closed")
    func openAndCloseTrackState() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (controller, _, _) = makeController()

        #expect(controller.isOpen == false)
        controller.open(animated: false)
        #expect(controller.isOpen == true)
        controller.close(animated: false)
        #expect(controller.isOpen == false)
    }

    @Test("open is idempotent while already open, and close is idempotent while already closed")
    func openCloseAreIdempotent() {
        _ = makeManager(activeThemeID: BuiltInThemes.solarizedDark.id)
        let (controller, _, _) = makeController()

        controller.close(animated: false)
        #expect(controller.isOpen == false)

        controller.open(animated: false)
        controller.open(animated: false)
        #expect(controller.isOpen == true)
    }
}
