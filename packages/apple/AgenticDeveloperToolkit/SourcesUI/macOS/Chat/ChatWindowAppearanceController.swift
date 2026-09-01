import AppKit

/// The gear on a chat window and the four switches behind it — text size,
/// transparency, whether the window floats, whether the caret blinks — wired
/// to a `WindowAppearanceDefaults` that outlives the launch.
///
/// In the toolkit rather than in each app because none of it is one app's:
/// every window that hosts an `InlineChatView` wants the same four switches,
/// in the same order, saved the same way, and restored on the way back up. An
/// app supplies the two things that really are its own — the panel's title and
/// the defaults namespace — and gets the rest.
///
/// The three appliers are the same code the popover's controls call and the
/// same code `restore()` calls, so there is one description of what each
/// setting *does* rather than one for changing and one for restoring.
@MainActor
public final class ChatWindowAppearanceController {

    public let defaults: WindowAppearanceDefaults

    /// Held because `NSTitlebarAccessoryViewController` retains only the view:
    /// the component that owns the popover and the gear's target has no other
    /// owner.
    private var popover: WindowConfigPopover?

    private let title: String
    private weak var window: NSWindow?
    private weak var chatView: InlineChatView?

    public init(
        window: NSWindow,
        chatView: InlineChatView,
        defaults: WindowAppearanceDefaults,
        title: String
    ) {
        self.window = window
        self.chatView = chatView
        self.defaults = defaults
        self.title = title
    }

    /// Puts the gear in the window's right title-bar accessory and replays
    /// what was saved.
    ///
    /// A real `NSTitlebarAccessoryViewController` even on a window that shows
    /// no title bar: as long as `.titled` is in the style mask the bar exists
    /// to hang an accessory on, whatever has been done to its material, its
    /// title and its traffic lights. Floating a button over the content
    /// instead would have to re-derive the position the title bar already
    /// knows, and would move with whatever it was floating over.
    public func install(leading: [NSView] = []) {
        guard let window else { return }
        let popover = WindowConfigPopover(title: title) { [weak self] in
            self?.makeControls() ?? []
        }
        window.addTitlebarAccessoryViewController(popover.makeTitlebarAccessory(leading: leading))
        self.popover = popover
        restore()
    }

    /// Replays the saved settings onto the window and the chat, so the four
    /// switches survive a relaunch.
    public func restore() {
        applyTextScale(defaults.textScale)
        applyTransparency(defaults.transparency)
        applyFloating(defaults.isFloating)
        chatView?.blinksCaret = defaults.blinksCaret
    }

    /// Built on first open rather than at construction, so the controls read
    /// live values and a window pays nothing for the panel at launch.
    private func makeControls() -> [NSView] {
        [
            WindowConfigSlider(
                title: "Text Size",
                value: defaults.textScale,
                range: WindowAppearanceDefaults.textScaleRange,
                caption: { "\(Int(($0 * 100).rounded()))%" },
                onChange: { [weak self] scale in
                    self?.defaults.textScale = scale
                    self?.applyTextScale(scale)
                }),
            WindowConfigSlider(
                title: "Transparency",
                value: defaults.transparency,
                range: WindowAppearanceDefaults.transparencyRange,
                caption: { "\(Int(((1 - $0) * 100).rounded()))% transparent" },
                onChange: { [weak self] alpha in
                    self?.defaults.transparency = alpha
                    self?.applyTransparency(alpha)
                }),
            WindowConfigToggle(
                title: "Float above other windows",
                isOn: defaults.isFloating,
                onChange: { [weak self] floating in
                    self?.defaults.isFloating = floating
                    self?.applyFloating(floating)
                }),
            WindowConfigToggle(
                title: "Blink caret",
                isOn: defaults.blinksCaret,
                onChange: { [weak self] blinks in
                    self?.defaults.blinksCaret = blinks
                    self?.chatView?.blinksCaret = blinks
                })
        ]
    }

    /// Through the theme manager rather than the chat view: every themed view
    /// resolves its own palette from there, so this is the one place a single
    /// number reaches the transcript, the status line and the composer alike.
    private func applyTextScale(_ scale: Double) {
        ThemeManager.shared?.textScale = scale
    }

    private func applyTransparency(_ alpha: Double) {
        window?.alphaValue = CGFloat(alpha)
    }

    private func applyFloating(_ floating: Bool) {
        window?.level = floating ? .floating : .normal
    }
}
