import AppKit
import AgenticDeveloperToolkit

/// A pulsing three-dot "someone is composing" indicator, themed from the
/// active `SemanticPalette` and repainting live on theme change.
///
/// Kept deliberately minimal — a fixed three-dot pulse, no phase awareness.
/// Task 7 seam: `ThinkingPhase`'s state machine (braille frames, rotating
/// status words drawn from `ChatStatus`/`ChatStatusWordPair`, the settled
/// "thought for Ns" line) replaces the fixed animation here and attaches via
/// a new `update(status:)` method; `startAnimating`/`stopAnimating` and
/// `applyTheme` are the seam it grows from.
@MainActor
public final class ThinkingIndicatorView: NSView, Themeable {

    private let dots: [NSView] = (0..<3).map { _ in
        let dot = NSView()
        dot.wantsLayer = true
        dot.translatesAutoresizingMaskIntoConstraints = false
        return dot
    }

    private var timer: Timer?
    private var step = 0
    private var themeObserver: ThemePaletteObserver?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    public convenience init() {
        self.init(frame: .zero)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    deinit {
        timer?.invalidate()
    }

    private func setup() {
        wantsLayer = true
        layer?.cornerRadius = 12
        translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView(views: dots)
        stack.orientation = .horizontal
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            widthAnchor.constraint(equalToConstant: 48),
            heightAnchor.constraint(equalToConstant: 28)
        ])
        for dot in dots {
            NSLayoutConstraint.activate([
                dot.widthAnchor.constraint(equalToConstant: 7),
                dot.heightAnchor.constraint(equalToConstant: 7)
            ])
            dot.layer?.cornerRadius = 3.5
            dot.alphaValue = 0.3
        }

        themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    public func applyTheme(_ palette: SemanticPalette) {
        layer?.backgroundColor = palette.nsColor(.chatSurface).cgColor
        for dot in dots {
            dot.layer?.backgroundColor = palette.nsColor(.secondaryText).cgColor
        }
    }

    /// Starts the pulse from the beginning. Idempotent — calling it again
    /// simply restarts the cycle.
    public func startAnimating() {
        for dot in dots { dot.alphaValue = 0.3 }
        step = 0
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: true) { [weak self] _ in
            guard let self else { return }
            MainActor.assumeIsolated { self.tick() }
        }
    }

    public func stopAnimating() {
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        let active = step % dots.count
        for (index, dot) in dots.enumerated() {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.2
                dot.animator().alphaValue = (index == active) ? 1.0 : 0.3
            }
        }
        step += 1
    }

    public override func removeFromSuperview() {
        stopAnimating()
        super.removeFromSuperview()
    }
}
