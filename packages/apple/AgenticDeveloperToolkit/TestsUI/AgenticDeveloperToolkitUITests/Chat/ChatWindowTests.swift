import Testing
import AppKit
import Foundation
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

/// The window a host gets for free — the frame it remembers, the scope its
/// content declares, the refit seam the gear freezes — and the switches behind
/// its gear.
@MainActor
@Suite("Chat window")
struct ChatWindowTests {

    private func makeController(
        namespace: String = "toolkit.tests.chat",
        backdrop: NSView? = nil
    ) -> ChatWindowController {
        let viewModel = ObservableChatViewModel(backend: FakeBackend(), localParticipantID: "user")
        return ChatWindowController(
            viewModel: viewModel,
            localParticipantID: "user",
            configuration: ChatWindowConfiguration(
                title: "Test Chat",
                defaultsNamespace: namespace,
                appearanceTitle: "Test Chat Window"),
            backdrop: backdrop)
    }

    private func checkboxTitles(in views: [NSView]) -> [String] {
        var found: [String] = []
        func walk(_ view: NSView) {
            if let button = view as? NSButton, !button.title.isEmpty { found.append(button.title) }
            view.subviews.forEach(walk)
        }
        views.forEach(walk)
        return found
    }

    // MARK: The frame it remembers

    /// Two chats in one app are two windows, and a frame saved under one
    /// hard-coded name is one window's frame imposed on both. The namespace is
    /// already what separates two chats' settings; the frame is one more of them.
    @Test("the saved frame is namespaced, so two chats remember two frames")
    func frameIsNamespaced() throws {
        let first = makeController(namespace: "toolkit.tests.alpha")
        let second = makeController(namespace: "toolkit.tests.beta")
        let a = try #require(first.window)
        let b = try #require(second.window)
        #expect(a.frameAutosaveName == "toolkit.tests.alpha.chatWindowFrame")
        #expect(b.frameAutosaveName == "toolkit.tests.beta.chatWindowFrame")
    }

    // MARK: The scope its content declares

    /// The chat's scope has to be reachable from *outside* the chat view, or
    /// anything the window puts beside it — the key-window border, a host's own
    /// chrome — resolves to the app scope and paints at 100% while the chat
    /// beside it is at 150%.
    @Test("the content view declares the chat's scope for everything in the window")
    func contentViewDeclaresTheScope() throws {
        let controller = makeController()
        let content = try #require(controller.window?.contentView)
        let sibling = NSView()
        content.addSubview(sibling)

        #expect(content.resolvedThemeScope === controller.chatView.themeScope)
        #expect(sibling.resolvedThemeScope === controller.chatView.themeScope)
    }

    // MARK: The refit seam

    /// Both halves are documented as idempotent, because the gear calls them
    /// from notifications whose pairing it does not control.
    @Test("suppressing and resuming the refit are each safe to repeat")
    func refitSeamIsIdempotent() throws {
        let controller = makeController()
        let window = try #require(controller.window)
        let minSize = window.contentMinSize
        let maxSize = window.contentMaxSize

        controller.suppressContentRefit()
        controller.suppressContentRefit()
        let frozen = window.contentRect(forFrameRect: window.frame).size
        #expect(window.contentMinSize == frozen)
        #expect(window.contentMaxSize == frozen)

        controller.resumeContentRefit()
        controller.resumeContentRefit()
        #expect(window.contentMinSize == minSize)
        #expect(window.contentMaxSize == maxSize)
    }

    /// A resume that never saw a suppress must not invent limits — that is what
    /// "a window with nothing to refit is free to do nothing" means.
    @Test("resuming a window that was never suppressed changes nothing")
    func resumeWithoutSuppressIsANoOp() throws {
        let controller = makeController()
        let window = try #require(controller.window)
        let minSize = window.contentMinSize
        let maxSize = window.contentMaxSize

        controller.resumeContentRefit()
        #expect(window.contentMinSize == minSize)
        #expect(window.contentMaxSize == maxSize)
    }

    // MARK: The switches behind the gear

    /// The switch is documented as appearing "only when the window has a
    /// backdrop", and a switch whose setting nothing reads is one that lies
    /// about what it does.
    @Test("a chat with no backdrop gets no backdrop switch")
    func backdropSwitchIsAbsentWithoutABackdrop() {
        let controller = makeController()
        let titles = checkboxTitles(in: controller.appearance.makeControls())
        #expect(titles.contains("Background animation") == false)
        // The other switches are still all there, so this is the backdrop's
        // absence and not an empty panel.
        #expect(titles.contains("Blink caret"))
        #expect(titles.contains("Float above other windows"))
    }

    @Test("a chat with a backdrop gets one")
    func backdropSwitchAppearsWithABackdrop() {
        let controller = makeController(backdrop: NSView())
        #expect(checkboxTitles(in: controller.appearance.makeControls()).contains("Background animation"))
    }
}
