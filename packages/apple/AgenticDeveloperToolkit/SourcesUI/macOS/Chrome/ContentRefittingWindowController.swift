import AppKit

/// A window controller whose window sizes itself from its content, and which
/// can be told to hold still for a moment.
///
/// The moment in question is a config popover being open on that window. A
/// popover's sliders change the very things the content is measured from —
/// text size above all — so a window that refits on every change would walk
/// out from under the pointer mid-drag. The popover freezes the fit on open
/// and lifts the freeze on close, at which point one refit applies everything
/// the drag did.
///
/// It is a protocol rather than a concrete type because the window controller
/// that implements it (`SingleWindowController`) lives a layer *above* this
/// one, in AgenticToolkit, which depends on this package. The popover needs to
/// name the capability without naming the class.
///
/// Both calls are required to be idempotent: a popover can close more than
/// once, and a window with nothing to refit must be free to do nothing.
@MainActor
public protocol ContentRefittingWindowController: AnyObject {

    /// Freeze the window at its current size. Called as a config popover opens.
    func suppressContentRefit()

    /// Lift the freeze and apply one refit, so whatever the popover changed
    /// lands now. Called after a config popover closes.
    func resumeContentRefit()
}
