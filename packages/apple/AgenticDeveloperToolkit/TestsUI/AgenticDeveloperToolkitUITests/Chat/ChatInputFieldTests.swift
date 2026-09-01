import Testing
import AppKit
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

/// The composer's block caret, and the baseline it has to be able to report.
///
/// Both halves are here because they are the same field: the caret is drawn by
/// `ChatInputField` itself (AppKit will not shape a field editor's insertion
/// point, and would not let a host turn its blink off), and the baseline comes
/// from the padded cell that draws the room the caret sits in.
@MainActor
@Suite("ChatInputField")
struct ChatInputFieldTests {

    private func makeManager() -> ThemeManager {
        ThemeManager(storage: InMemoryThemeStorage(activeThemeID: BuiltInThemes.solarizedDark.id))
    }

    private func makeField(text: String = "") -> ChatInputField {
        let field = ChatInputField(string: text)
        field.frame = NSRect(x: 0, y: 0, width: 300, height: 26)
        field.layoutSubtreeIfNeeded()
        return field
    }

    // MARK: The caret

    @Test("a plain field draws no block caret and adds no layer")
    func noCaretByDefault() {
        let manager = makeManager()
        let field = makeField()
        #expect(field.usesBlockCaret == false)
        #expect(field.caretLayer.superlayer == nil)
        withExtendedLifetime(manager) {}
    }

    @Test("turning the block caret on attaches it lit, and turning it off takes it away again")
    func caretPresenceFollowsTheFlag() {
        let manager = makeManager()
        let field = makeField()

        field.usesBlockCaret = true
        #expect(field.caretLayer.superlayer != nil)
        #expect(field.caretLayer.isHidden == false)

        field.usesBlockCaret = false
        #expect(field.caretLayer.superlayer == nil)
        #expect(field.caretLayer.isHidden)
        withExtendedLifetime(manager) {}
    }

    @Test("with blinking on, the caret goes dark and comes back")
    func caretBlinks() {
        let manager = makeManager()
        let field = makeField()
        field.usesBlockCaret = true
        #expect(field.caretLayer.isHidden == false)

        // Just past one half-period, so the first flip has certainly fired.
        pumpRunLoop(for: ChatInputField.caretBlinkHalfPeriod + 0.15)
        #expect(field.caretLayer.isHidden)

        pumpRunLoop(for: ChatInputField.caretBlinkHalfPeriod + 0.15)
        #expect(field.caretLayer.isHidden == false)
        withExtendedLifetime(manager) {}
    }

    /// The "Blink caret" switch a host surfaces. AppKit offers no way to stop a
    /// field editor's insertion point blinking, which is half the reason the
    /// caret is drawn here at all.
    @Test("with blinking off, the caret parks lit and stays lit")
    func caretCanParkSolid() {
        let manager = makeManager()
        let field = makeField()
        field.usesBlockCaret = true
        field.caretBlinks = false

        pumpRunLoop(for: ChatInputField.caretBlinkHalfPeriod * 2 + 0.2)
        #expect(field.caretLayer.isHidden == false)
        withExtendedLifetime(manager) {}
    }

    @Test("switching blinking back on resumes it from lit")
    func blinkingResumes() {
        let manager = makeManager()
        let field = makeField()
        field.usesBlockCaret = true
        field.caretBlinks = false
        pumpRunLoop(for: 0.1)

        field.caretBlinks = true
        #expect(field.caretLayer.isHidden == false)
        pumpRunLoop(for: ChatInputField.caretBlinkHalfPeriod + 0.15)
        #expect(field.caretLayer.isHidden)
        withExtendedLifetime(manager) {}
    }

    @Test("the caret sits after the text, one character wide, and moves as the text grows")
    func caretTracksTheText() {
        let manager = makeManager()
        let field = makeField()
        field.usesBlockCaret = true

        field.stringValue = ""
        field.positionCaret()
        let atStart = field.caretLayer.frame

        field.stringValue = "olylo"
        field.positionCaret()
        let afterText = field.caretLayer.frame

        #expect(afterText.minX > atStart.minX)
        #expect(atStart.width > 0)
        #expect(atStart.height > 0)
        // One character cell, measured from the live font — a fixed width would
        // sit under half a glyph the moment a theme scales its type.
        let cell = ("0" as NSString).size(withAttributes: [.font: field.font!]).width
        #expect(abs(atStart.width - cell) < 0.5)
        withExtendedLifetime(manager) {}
    }

    @Test("the caret is painted, not transparent")
    func caretHasInk() {
        let manager = makeManager()
        let field = makeField()
        field.usesBlockCaret = true
        #expect(field.caretLayer.backgroundColor != nil)
        #expect((field.caretLayer.backgroundColor?.alpha ?? 0) > 0)
        withExtendedLifetime(manager) {}
    }

    // MARK: The baseline

    /// A regression, and the reason the cell clamps its inset.
    ///
    /// AppKit asks the cell for its baseline with a probe rect narrower than
    /// the horizontal inset (4×16, measured). An unclamped `insetBy` inverts
    /// that rect, `NSTextFieldCell` answers with an infinite origin, and the
    /// infinity comes straight back out as the field's baseline. Any
    /// `.firstBaseline` stack then hands it to the layout engine, which
    /// rejects it — `Invalid parameter not satisfying: isfinite(c)` — and
    /// takes the process down.
    @Test("reports finite baselines despite the cell's padding")
    func baselinesAreFinite() {
        let manager = makeManager()
        let field = makeField(text: "olylo")
        #expect(field.firstBaselineOffsetFromTop.isFinite)
        #expect(field.lastBaselineOffsetFromBottom.isFinite)
        withExtendedLifetime(manager) {}
    }

    @Test("the padding shows up in the baseline rather than being lost")
    func baselineIncludesThePadding() {
        let manager = makeManager()
        let field = makeField(text: "olylo")
        let plain = NSTextField(string: "olylo")
        plain.font = field.font
        // The prompt is aligned against this number; if the padded field
        // reported the unpadded baseline, the glyph would sit high by exactly
        // the inset.
        #expect(field.firstBaselineOffsetFromTop > plain.firstBaselineOffsetFromTop)
        withExtendedLifetime(manager) {}
    }

    @Test("lays out inside a first-baseline stack, which is how the composer aligns its prompt")
    func survivesABaselineAlignedStack() {
        let manager = makeManager()
        let field = makeField(text: "olylo")
        field.translatesAutoresizingMaskIntoConstraints = false
        let prompt = NSTextField(labelWithString: "\u{276F}")
        prompt.translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView(views: [prompt, field])
        stack.orientation = .horizontal
        stack.alignment = .firstBaseline
        stack.frame = NSRect(x: 0, y: 0, width: 320, height: 40)
        stack.layoutSubtreeIfNeeded()

        #expect(field.frame.origin.y.isFinite)
        #expect(prompt.frame.origin.y.isFinite)
        withExtendedLifetime(manager) {}
    }
}
