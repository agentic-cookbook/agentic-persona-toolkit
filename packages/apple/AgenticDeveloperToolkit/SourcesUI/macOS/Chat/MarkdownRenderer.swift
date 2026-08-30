import AppKit
import Foundation
import AgenticDeveloperToolkit

/// Supplies syntax colouring for fenced code blocks. ADT ships no highlighter:
/// the web side gets this from Shiki, and pulling an equivalent grammar stack
/// into a framework customers embed is not a trade worth making. A host that
/// already has one injects it here.
public protocol CodeHighlighter: Sendable {
    func highlight(_ code: String, language: String?, palette: SemanticPalette) -> NSAttributedString?
}

/// Turns a message's markdown into a themed `NSAttributedString`.
///
/// Lives in `SourcesUI/macOS` rather than `SourcesUI/Shared` because both
/// accessors it depends on — `SemanticPalette.nsColor(_:)` and
/// `SemanticPalette.font(_:)` — are macOS-only extensions, and `Shared`
/// compiles into the iOS target too. Moving it down is Task 8's call, once a
/// `SemanticPalette+UIColor` exists to move it onto.
///
/// Block structure comes from `AttributedString(markdown:)`'s
/// `presentationIntent`: runs are grouped by block, blocks are rejoined with a
/// blank line, and a fenced block is offered to `highlighter` before falling
/// back to themed monospaced text. Unhighlighted code is correct, just
/// monochrome.
public struct MarkdownRenderer: Sendable {

    /// Absent by default — the shipped behaviour. A host with its own grammar
    /// stack injects one and every fenced block routes through it.
    public let highlighter: (any CodeHighlighter)?

    public init(highlighter: (any CodeHighlighter)? = nil) {
        self.highlighter = highlighter
    }

    public func render(_ markdown: String, palette: SemanticPalette, textColor: NSColor) -> NSAttributedString {
        let bodyAttributes: [NSAttributedString.Key: Any] = [
            .font: palette.font(.body),
            .foregroundColor: textColor
        ]

        // `.returnPartiallyParsedIfPossible` rather than a throw: half-typed
        // markdown arrives on every streaming draft, and a parse failure must
        // degrade to plain text, never to an empty bubble.
        guard let parsed = try? AttributedString(
            markdown: markdown,
            options: AttributedString.MarkdownParsingOptions(
                allowsExtendedAttributes: true,
                interpretedSyntax: .full,
                failurePolicy: .returnPartiallyParsedIfPossible)
        ) else {
            return NSAttributedString(string: markdown, attributes: bodyAttributes)
        }

        let output = NSMutableAttributedString()
        for (intent, range) in parsed.runs[\.presentationIntent] {
            if output.length > 0 {
                output.append(NSAttributedString(string: "\n\n", attributes: bodyAttributes))
            }
            let block = parsed[range]
            if let codeBlock = Self.codeBlock(intent) {
                output.append(renderCodeBlock(
                    String(block.characters),
                    language: codeBlock.languageHint,
                    palette: palette,
                    textColor: textColor))
            } else {
                for run in block.runs {
                    output.append(NSAttributedString(
                        string: String(parsed[run.range].characters),
                        attributes: Self.inlineAttributes(
                            for: run, base: bodyAttributes, palette: palette, textColor: textColor)))
                }
            }
        }
        return output
    }

    // MARK: Blocks

    private func renderCodeBlock(
        _ raw: String,
        language: String?,
        palette: SemanticPalette,
        textColor: NSColor
    ) -> NSAttributedString {
        // The parser leaves a fenced block's trailing newline in place; it
        // would render as a blank line on top of the blank line between
        // blocks.
        let code = raw.hasSuffix("\n") ? String(raw.dropLast()) : raw
        if let highlighted = highlighter?.highlight(code, language: language, palette: palette) {
            return highlighted
        }
        return NSAttributedString(string: code, attributes: [
            .font: palette.font(.code),
            .foregroundColor: textColor,
            .backgroundColor: palette.nsColor(.controlBackground)
        ])
    }

    /// Present when the block is a fenced code block. A struct rather than a
    /// bare `String?` so "not a code block" and "a code block whose fence
    /// named no language" stay distinguishable — ` ``` ` on its own is still
    /// a code block, just an unlabelled one.
    struct CodeBlock {
        let languageHint: String?
    }

    private static func codeBlock(_ intent: PresentationIntent?) -> CodeBlock? {
        guard let intent else { return nil }
        for component in intent.components {
            if case .codeBlock(let languageHint) = component.kind {
                return CodeBlock(languageHint: languageHint)
            }
        }
        return nil
    }

    // MARK: Inline spans

    private static func inlineAttributes(
        for run: AttributedString.Runs.Run,
        base: [NSAttributedString.Key: Any],
        palette: SemanticPalette,
        textColor: NSColor
    ) -> [NSAttributedString.Key: Any] {
        var attributes = base
        let intent = run.inlinePresentationIntent ?? []

        if intent.contains(.code) {
            attributes[.font] = palette.font(.code)
            attributes[.backgroundColor] = palette.nsColor(.controlBackground)
        } else {
            var traits: NSFontTraitMask = []
            if intent.contains(.stronglyEmphasized) { traits.insert(.boldFontMask) }
            if intent.contains(.emphasized) { traits.insert(.italicFontMask) }
            if !traits.isEmpty {
                attributes[.font] = NSFontManager.shared.convert(palette.font(.body), toHaveTrait: traits)
            }
        }
        if intent.contains(.strikethrough) {
            attributes[.strikethroughStyle] = NSUnderlineStyle.single.rawValue
        }
        if let link = run.link {
            attributes[.link] = link
            attributes[.foregroundColor] = palette.nsColor(.accent)
            attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
        }
        return attributes
    }
}
