import Foundation
import CoreGraphics

/// The parts of a chat's appearance that a `ColorTheme` has nowhere to put.
///
/// `ColorTheme` carries colours and typography, which covers most of what a
/// web theme's CSS says — but not all of it. `old-school-terminal` also sets
/// `--pc-radius: 0`, removes the rule above the composer, and swaps the send
/// button's SVG for a `↵` glyph (`.pc-send-btn::before { content: "\u{21B5}" }`).
/// None of those is a colour, so none of them survived the port, and a Swift
/// chat wearing a terminal palette still had rounded controls, a hairline, and
/// an SF Symbol.
///
/// Modelled as host configuration rather than as new `ColorTheme` fields, and
/// deliberately: a theme is data that syncs between devices and is authored in
/// a picker, so every field added to it is a migration and a row in a settings
/// panel forever. This is three knobs a host sets once when it builds its chat
/// — the same shape `InlineChatSizing` already has, next door. If a future
/// theme really needs to carry them, moving them into `ColorTheme` is a
/// mechanical change from here; the reverse is not.
public struct InlineChatChrome: Sendable {

    /// The glyph drawn on the send button, or `nil` for the stock
    /// `arrow.up.circle.fill` SF Symbol. `"\u{21B5}"` is web's terminal themes.
    public var sendGlyph: String?

    /// The hairline between the status line and the composer. Terminal themes
    /// set `border-top: none` and want this off; every other theme keeps it.
    public var showsDivider: Bool = true

    /// The composer's corner radius — web's `--pc-radius`, which
    /// `old-school-terminal` sets to `0`.
    public var inputCornerRadius: CGFloat = 6

    /// The composer's placeholder. A persona's own invitation to type belongs
    /// to the host, not to the toolkit — web re-rolls olylo's from a list on
    /// every send.
    public var inputPlaceholder: String = "Type a message..."

    public init(
        sendGlyph: String? = nil,
        showsDivider: Bool = true,
        inputCornerRadius: CGFloat = 6,
        inputPlaceholder: String = "Type a message..."
    ) {
        self.sendGlyph = sendGlyph
        self.showsDivider = showsDivider
        self.inputCornerRadius = inputCornerRadius
        self.inputPlaceholder = inputPlaceholder
    }

    /// The flat-terminal look web's `old-school-terminal`, `terminal`,
    /// `crt-monitor` and `green-matrix` themes share: squared off, no rule,
    /// and a return-arrow to send.
    public static let terminal = InlineChatChrome(
        sendGlyph: "\u{21B5}",
        showsDivider: false,
        inputCornerRadius: 0
    )
}
