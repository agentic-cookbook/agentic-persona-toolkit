import AppKit

/// A gear button and the popover it opens: the standing place for a window's
/// own appearance switches — text size, transparency, whether it floats — as
/// distinct from the app's settings.
///
/// It is a component rather than something each window assembles because the
/// gear's *position* is the convention. A reader who finds it at the trailing
/// edge of one window's title bar looks for it there in the next one, and a
/// window that puts it somewhere else has spent that recognition for nothing.
/// The controls differ per window; where the button sits does not.
///
/// The popover's body is built once, on first open, so a host's control
/// closures can bind to live values without a window paying for them at
/// launch.
@MainActor
public final class WindowConfigPopover: NSObject {

    /// Place this in the window's chrome — `makeTitlebarAccessory()` does it
    /// the conventional way, but a borderless window with no title bar can put
    /// the same button in its own content instead.
    public let gearButton = NSButton()

    public var isShown: Bool { popover.isShown }

    private let title: String
    private let makeControls: @MainActor () -> [NSView]
    private let popover = NSPopover()
    private var contentBuilt = false

    public init(
        title: String,
        tooltip: String = "Window appearance",
        makeControls: @escaping @MainActor () -> [NSView]
    ) {
        self.title = title
        self.makeControls = makeControls
        super.init()

        gearButton.translatesAutoresizingMaskIntoConstraints = false
        gearButton.bezelStyle = .accessoryBarAction
        gearButton.isBordered = false
        gearButton.image = NSImage(systemSymbolName: "gearshape", accessibilityDescription: tooltip)
        gearButton.imagePosition = .imageOnly
        gearButton.toolTip = tooltip
        gearButton.target = self
        gearButton.action = #selector(gearTapped)
        gearButton.contentTintColor = .secondaryLabelColor

        popover.behavior = .transient
    }

    /// A right-hand title bar accessory holding the gear, plus whatever
    /// window-specific chrome the host wants to its left.
    ///
    /// The container is given an explicit frame on purpose:
    /// `NSTitlebarAccessoryViewController` lays its view out by frame, not by
    /// auto layout, so a purely constraint-driven view reports zero width and
    /// never appears.
    public func makeTitlebarAccessory(
        leading: [NSView] = [],
        width: CGFloat = 120
    ) -> NSTitlebarAccessoryViewController {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: width, height: 28))
        container.autoresizingMask = [.minXMargin]

        let row = NSStackView(views: leading + [gearButton])
        row.orientation = .horizontal
        row.spacing = 6
        row.alignment = .centerY
        row.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(row)
        NSLayoutConstraint.activate([
            row.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -10),
            row.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 8),
            row.centerYAnchor.constraint(equalTo: container.centerYAnchor)
        ])

        let controller = NSTitlebarAccessoryViewController()
        controller.view = container
        controller.layoutAttribute = .right
        return controller
    }

    @objc private func gearTapped() { toggle() }

    public func toggle() {
        if popover.isShown {
            popover.close()
            return
        }
        if !contentBuilt {
            popover.contentViewController = ContentViewController(title: title, controls: makeControls())
            contentBuilt = true
        }
        // `.maxY`, which is *down* from a title-bar accessory: AppKit reads the
        // edge in the positioning view's own coordinates, and the accessory's
        // are flipped, so `.minY` floated the panel off the top of the window
        // with its arrow pointing back down at the gear. A gear at the top of a
        // window drops its options over the window, the way every other
        // titlebar control does.
        popover.show(relativeTo: gearButton.bounds, of: gearButton, preferredEdge: .maxY)
    }

    /// The popover body: a caption over the controls at one fixed width, so
    /// every row's slider starts and ends in the same place. Internal so a
    /// test can assert the assembly without presenting a popover.
    final class ContentViewController: NSViewController {
        static let popoverWidth: CGFloat = 300

        private let popoverTitle: String
        private let controls: [NSView]

        init(title: String, controls: [NSView]) {
            self.popoverTitle = title
            self.controls = controls
            super.init(nibName: nil, bundle: nil)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) { fatalError("ContentViewController is code-built, never decoded") }

        override func loadView() {
            let titleLabel = NSTextField(labelWithString: popoverTitle)
            titleLabel.font = NSFont.boldSystemFont(ofSize: NSFont.smallSystemFontSize)
            titleLabel.textColor = .secondaryLabelColor

            let stack = NSStackView(views: [titleLabel] + controls)
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = 12
            stack.edgeInsets = NSEdgeInsets(top: 14, left: 16, bottom: 14, right: 16)
            stack.translatesAutoresizingMaskIntoConstraints = false

            let root = NSView()
            root.addSubview(stack)
            var constraints = [
                stack.topAnchor.constraint(equalTo: root.topAnchor),
                stack.bottomAnchor.constraint(equalTo: root.bottomAnchor),
                stack.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                stack.trailingAnchor.constraint(equalTo: root.trailingAnchor),
                root.widthAnchor.constraint(equalToConstant: Self.popoverWidth)
            ]
            // Every control spans the popover minus the stack's insets, so the
            // sliders get room and their captions right-align to one edge.
            // Leading-aligned content such as a checkbox is unaffected by the
            // extra trailing space.
            for control in controls {
                constraints.append(control.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -32))
            }
            NSLayoutConstraint.activate(constraints)
            view = root
        }
    }
}

/// A titled slider with a caption that updates as it moves.
///
/// The caption is the point. A slider between two unlabelled ends tells a
/// reader only that they have moved it; "120%" tells them where they are and
/// lets them put it back.
@MainActor
public final class WindowConfigSlider: NSView {

    private let slider = NSSlider()
    private let captionLabel = NSTextField(labelWithString: "")
    private let caption: (Double) -> String
    private let onChange: (Double) -> Void

    public var value: Double { slider.doubleValue }

    public init(
        title: String,
        value: Double,
        range: ClosedRange<Double>,
        caption: @escaping (Double) -> String,
        onChange: @escaping (Double) -> Void
    ) {
        self.caption = caption
        self.onChange = onChange
        super.init(frame: .zero)

        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = NSFont.systemFont(ofSize: NSFont.smallSystemFontSize)

        captionLabel.font = NSFont.systemFont(ofSize: NSFont.smallSystemFontSize)
        captionLabel.textColor = .secondaryLabelColor
        captionLabel.alignment = .right
        captionLabel.stringValue = caption(value)

        slider.minValue = range.lowerBound
        slider.maxValue = range.upperBound
        slider.doubleValue = Swift.max(range.lowerBound, Swift.min(range.upperBound, value))
        slider.isContinuous = true
        slider.target = self
        slider.action = #selector(sliderMoved)

        let header = NSStackView(views: [titleLabel, captionLabel])
        header.orientation = .horizontal
        header.distribution = .fill
        titleLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)
        captionLabel.setContentHuggingPriority(.required, for: .horizontal)

        let stack = NSStackView(views: [header, slider])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            header.widthAnchor.constraint(equalTo: stack.widthAnchor),
            slider.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    @objc private func sliderMoved() {
        captionLabel.stringValue = caption(slider.doubleValue)
        onChange(slider.doubleValue)
    }
}

/// A checkbox that reports its new state.
@MainActor
public final class WindowConfigToggle: NSView {

    private let checkbox: NSButton
    private let onChange: (Bool) -> Void

    public var isOn: Bool { checkbox.state == .on }

    public init(title: String, isOn: Bool, onChange: @escaping (Bool) -> Void) {
        self.onChange = onChange
        checkbox = NSButton(checkboxWithTitle: title, target: nil, action: nil)
        super.init(frame: .zero)

        checkbox.state = isOn ? .on : .off
        checkbox.font = NSFont.systemFont(ofSize: NSFont.smallSystemFontSize)
        checkbox.target = self
        checkbox.action = #selector(toggled)
        checkbox.translatesAutoresizingMaskIntoConstraints = false
        addSubview(checkbox)
        NSLayoutConstraint.activate([
            checkbox.topAnchor.constraint(equalTo: topAnchor),
            checkbox.bottomAnchor.constraint(equalTo: bottomAnchor),
            checkbox.leadingAnchor.constraint(equalTo: leadingAnchor),
            checkbox.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor)
        ])
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    @objc private func toggled() {
        onChange(isOn)
    }
}
