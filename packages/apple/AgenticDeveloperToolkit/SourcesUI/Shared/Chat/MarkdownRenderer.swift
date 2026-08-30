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
/// Moved here from `SourcesUI/macOS` in Task 8b, once
/// `SemanticPalette.platformColor(_:)`/`platformFont(_:)` gave both platforms
/// the same accessor shape (`PlatformColor`/`PlatformFont`) — this type reads
/// a palette through those, never through `nsColor(_:)`/`font(_:)` directly,
/// so it compiles unchanged into both the macOS and iOS UI targets.
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

    public func render(_ markdown: String, palette: SemanticPalette, textColor: PlatformColor) -> NSAttributedString {
        let bodyAttributes: [NSAttributedString.Key: Any] = [
            .font: palette.platformFont(.body),
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
        textColor: PlatformColor
    ) -> NSAttributedString {
        // The parser leaves a fenced block's trailing newline in place; it
        // would render as a blank line on top of the blank line between
        // blocks.
        let code = raw.hasSuffix("\n") ? String(raw.dropLast()) : raw
        if let highlighted = highlighter?.highlight(code, language: language, palette: palette) {
            return highlighted
        }
        return NSAttributedString(string: code, attributes: [
            .font: palette.platformFont(.code),
            .foregroundColor: textColor,
            .backgroundColor: palette.platformColor(.controlBackground)
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
        textColor: PlatformColor
    ) -> [NSAttributedString.Key: Any] {
        var attributes = base
        let intent = run.inlinePresentationIntent ?? []

        if intent.contains(.code) {
            attributes[.font] = palette.platformFont(.code)
            attributes[.backgroundColor] = palette.platformColor(.controlBackground)
        } else {
            let bold = intent.contains(.stronglyEmphasized)
            let italic = intent.contains(.emphasized)
            if bold || italic {
                attributes[.font] = palette.platformFont(.body).applying(bold: bold, italic: italic)
            }
        }
        // `NSUnderlineStyle` itself lives in AppKit/UIKit, not Foundation,
        // so it isn't available in this Shared, Foundation-only file — the
        // platform bridge (amendment 4) only prescribes `PlatformColor`/
        // `PlatformFont`/`applying(bold:italic:)`. `.single`'s raw value is
        // `1` on both platforms, so it's used directly here rather than
        // introducing a new cross-platform enum the plan didn't ask for.
        let singleUnderlineStyleRawValue = 1
        if intent.contains(.strikethrough) {
            attributes[.strikethroughStyle] = singleUnderlineStyleRawValue
        }
        if let link = run.link {
            attributes[.link] = link
            attributes[.foregroundColor] = palette.platformColor(.accent)
            attributes[.underlineStyle] = singleUnderlineStyleRawValue
        }
        return attributes
    }
}
