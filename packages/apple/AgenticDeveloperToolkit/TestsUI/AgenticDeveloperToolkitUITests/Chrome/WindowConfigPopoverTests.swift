import Testing
import AppKit
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

/// The gear a window puts at the trailing edge of its title bar, and the two
/// controls it hangs underneath.
@MainActor
@Suite("WindowConfigPopover")
struct WindowConfigPopoverTests {

    private func slider(in view: NSView) -> NSSlider? {
        if let slider = view as? NSSlider { return slider }
        for subview in view.subviews {
            if let found = slider(in: subview) { return found }
        }
        return nil
    }

    private func button(in view: NSView) -> NSButton? {
        if let button = view as? NSButton { return button }
        for subview in view.subviews {
            if let found = button(in: subview) { return found }
        }
        return nil
    }

    private func labels(in view: NSView) -> [String] {
        var found: [String] = []
        if let field = view as? NSTextField { found.append(field.stringValue) }
        for subview in view.subviews { found += labels(in: subview) }
        return found
    }

    // MARK: The gear

    @Test("the gear carries an icon and its own action, and starts closed")
    func gearIsWired() {
        var built = false
        let popover = WindowConfigPopover(title: "Olylo Window") {
            built = true
            return []
        }
        #expect(popover.gearButton.image != nil)
        #expect(popover.gearButton.target != nil)
        #expect(popover.gearButton.action != nil)
        #expect(popover.isShown == false)
        // The controls are a host's closure over live state, so they are built
        // when the panel first opens rather than at construction.
        #expect(built == false)
    }

    /// `NSTitlebarAccessoryViewController` lays its view out by frame, not by
    /// auto layout: a purely constraint-driven container reports zero width and
    /// never appears, which is a bug you can only see by looking at the window.
    @Test("the titlebar accessory has a real frame and holds the gear")
    func accessoryHasAFrame() {
        let popover = WindowConfigPopover(title: "Olylo Window") { [] }
        let controller = popover.makeTitlebarAccessory()
        #expect(controller.view.frame.width > 0)
        #expect(controller.view.frame.height > 0)
        #expect(controller.layoutAttribute == .right)

        var contains = false
        func walk(_ view: NSView) {
            if view === popover.gearButton { contains = true }
            view.subviews.forEach(walk)
        }
        walk(controller.view)
        #expect(contains)
    }

    @Test("leading chrome sits alongside the gear rather than replacing it")
    func accessoryKeepsLeadingViews() {
        let popover = WindowConfigPopover(title: "Olylo Window") { [] }
        let extra = NSButton(title: "x", target: nil, action: nil)
        let controller = popover.makeTitlebarAccessory(leading: [extra], width: 160)
        var seen: [NSView] = []
        func walk(_ view: NSView) {
            seen.append(view)
            view.subviews.forEach(walk)
        }
        walk(controller.view)
        #expect(seen.contains { $0 === extra })
        #expect(seen.contains { $0 === popover.gearButton })
        #expect(controller.view.frame.width == 160)
    }

    // MARK: The panel

    @Test("the panel captions itself and lays every control out at one width")
    func panelHoldsItsControls() {
        let first = WindowConfigToggle(title: "Float", isOn: false) { _ in }
        let second = WindowConfigToggle(title: "Blink caret", isOn: true) { _ in }
        let controller = WindowConfigPopover.ContentViewController(
            title: "Olylo Window", controls: [first, second])
        // A popover sizes itself from its content's fitting size, so that —
        // not a frame nobody has set — is what the width constraint governs.
        controller.view.frame = NSRect(origin: .zero, size: controller.view.fittingSize)
        controller.view.layoutSubtreeIfNeeded()

        #expect(labels(in: controller.view).contains("Olylo Window"))
        #expect(controller.view.fittingSize.width == WindowConfigPopover.ContentViewController.popoverWidth)
        // A slider that sized to its own content would start and end somewhere
        // different in each row; every control spans the same width instead.
        #expect(first.frame.width == second.frame.width)
        #expect(first.frame.width > 0)
    }

    // MARK: The controls

    @Test("a slider reports its title and a caption of where it is")
    func sliderCaptionsItself() {
        let control = WindowConfigSlider(
            title: "Text Size", value: 1.25, range: 0.85...1.75,
            caption: { "\(Int(($0 * 100).rounded()))%" },
            onChange: { _ in })
        let text = labels(in: control)
        #expect(text.contains("Text Size"))
        // A slider between two unlabelled ends tells a reader only that they
        // have moved it; the caption is what lets them put it back.
        #expect(text.contains("125%"))
    }

    @Test("a slider clamps a stored value that has drifted outside its range")
    func sliderClampsItsStartingValue() {
        let control = WindowConfigSlider(
            title: "Text Size", value: 9, range: 0.85...1.75,
            caption: { "\($0)" }, onChange: { _ in })
        #expect(control.value == 1.75)
    }

    @Test("moving a slider reports the new value as it goes")
    func sliderReportsChanges() throws {
        var reported: [Double] = []
        let control = WindowConfigSlider(
            title: "Transparency", value: 1, range: 0.3...1.0,
            caption: { "\($0)" }, onChange: { reported.append($0) })
        let inner = try #require(slider(in: control))
        #expect(inner.isContinuous)

        inner.doubleValue = 0.5
        _ = inner.target?.perform(inner.action, with: inner)
        #expect(reported.last == 0.5)
        #expect(control.value == 0.5)
    }

    @Test("a toggle starts where it was told to and reports each flip")
    func toggleReportsChanges() throws {
        var reported: [Bool] = []
        let control = WindowConfigToggle(title: "Blink caret", isOn: true) { reported.append($0) }
        #expect(control.isOn)
        #expect(labels(in: control).isEmpty)  // the title lives on the checkbox itself

        let inner = try #require(button(in: control))
        #expect(inner.title == "Blink caret")
        inner.state = .off
        _ = inner.target?.perform(inner.action, with: inner)
        #expect(reported == [false])
        #expect(control.isOn == false)
    }
}
