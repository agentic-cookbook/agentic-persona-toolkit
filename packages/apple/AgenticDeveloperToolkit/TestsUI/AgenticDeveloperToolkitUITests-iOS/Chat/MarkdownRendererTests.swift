import Testing
import UIKit
import Foundation
import AgenticDeveloperToolkit
@testable import AgenticDeveloperToolkitUI

/// Encodes its inputs into its output instead of recording them into shared
/// state, so the assertions can pin both the language hint and the
/// substitution without a mutable, `Sendable`-hostile test double.
private struct StubHighlighter: CodeHighlighter {
    func highlight(_ code: String, language: String?, palette: SemanticPalette) -> NSAttributedString? {
        NSAttributedString(string: "HL[\(language ?? "none")]:\(code)")
    }
}

/// A host highlighter that recognises nothing — the documented fallback path.
private struct AbstainingHighlighter: CodeHighlighter {
    func highlight(_ code: String, language: String?, palette: SemanticPalette) -> NSAttributedString? { nil }
}

@MainActor
@Suite("MarkdownRenderer")
struct MarkdownRendererTests {

    private var palette: SemanticPalette { SemanticPalette(theme: BuiltInThemes.solarizedDark) }

    private func render(
        _ text: String,
        highlighter: (any CodeHighlighter)? = nil
    ) -> NSAttributedString {
        MarkdownRenderer(highlighter: highlighter)
            .render(text, palette: palette, textColor: palette.uiColor(.personaText))
    }

    @Test("plain text renders verbatim in the body font and the given color")
    func plainTextIsBodyText() {
        let rendered = render("hello world")
        #expect(rendered.string == "hello world")
        let attributes = rendered.attributes(at: 0, effectiveRange: nil)
        #expect(attributes[.font] as? UIFont == palette.font(.body))
        #expect(attributes[.foregroundColor] as? UIColor == palette.uiColor(.personaText))
    }

    @Test("an inline code span drops its backticks and takes the code font")
    func inlineCodeSpanUsesCodeFont() {
        let rendered = render("call `reload()` now")
        #expect(rendered.string == "call reload() now")
        let location = (rendered.string as NSString).range(of: "reload()").location
        #expect(location != NSNotFound)
        #expect(rendered.attributes(at: location, effectiveRange: nil)[.font] as? UIFont == palette.font(.code))
    }

    @Test("a fenced block drops its fences and renders as themed monospaced text")
    func fencedBlockIsMonospaced() {
        let rendered = render("before\n\n```\nlet x = 1\n```")
        #expect(!rendered.string.contains("```"))
        #expect(rendered.string.contains("let x = 1"))
        let location = (rendered.string as NSString).range(of: "let x = 1").location
        let attributes = rendered.attributes(at: location, effectiveRange: nil)
        #expect(attributes[.font] as? UIFont == palette.font(.code))
        #expect(attributes[.foregroundColor] as? UIColor == palette.uiColor(.personaText))
    }

    @Test("an injected highlighter is given the block's code and language hint, and its output is used")
    func highlighterOutputIsUsed() {
        let rendered = render("```swift\nlet x = 1\n```", highlighter: StubHighlighter())
        #expect(rendered.string.contains("HL[swift]:let x = 1"))
    }

    @Test("a highlighter that abstains falls back to themed monospaced text")
    func abstainingHighlighterFallsBack() {
        let rendered = render("```swift\nlet x = 1\n```", highlighter: AbstainingHighlighter())
        #expect(rendered.string.contains("let x = 1"))
        let location = (rendered.string as NSString).range(of: "let x").location
        #expect(rendered.attributes(at: location, effectiveRange: nil)[.font] as? UIFont == palette.font(.code))
    }

    @Test("inline code inside a paragraph does not reach the highlighter — only fenced blocks do")
    func inlineCodeIsNotHighlighted() {
        let rendered = render("call `reload()` now", highlighter: StubHighlighter())
        #expect(!rendered.string.contains("HL["))
    }

    @Test("emphasis renders bold rather than leaving the asterisks in the text")
    func strongEmphasisIsBold() {
        let rendered = render("a **loud** word")
        #expect(rendered.string == "a loud word")
        let location = (rendered.string as NSString).range(of: "loud").location
        let font = rendered.attributes(at: location, effectiveRange: nil)[.font] as? UIFont
        #expect(font?.fontDescriptor.symbolicTraits.contains(.traitBold) == true)
    }

    @Test("two paragraphs stay two paragraphs")
    func paragraphsAreSeparated() {
        #expect(render("one\n\ntwo").string == "one\n\ntwo")
    }
}
