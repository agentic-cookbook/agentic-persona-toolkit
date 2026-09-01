import Foundation

public struct EngineOptions {
    public var config: CharacterConfig
    /// Seeds the ONE PRNG stream the reflexes and the saying picker share.
    public var seed: UInt32
    public var env: AvatarEnvironment
    /// Scene-build-time rig patch, e.g. the optical cut. `nil` builds the true rig.
    public var variant: String?

    public init(config: CharacterConfig, seed: UInt32 = 1,
                env: AvatarEnvironment = AvatarEnvironment(),
                variant: String? = nil) {
        self.config = config
        self.seed = seed
        self.env = env
        self.variant = variant
    }
}

/// Everything above this line is a part; this is the whole. A host needs this
/// type, `AvatarEnvironment`, `CharacterConfig.load` and `DisplayList`, and
/// nothing else in the package.
public final class Engine {
    /// Public, and deliberately so. Task 35's view needs `canvas` and
    /// `strokeStyle`; the alternative — passing the config to the view as well
    /// as to the engine — makes a mismatch possible, and a view rendering one
    /// character's canvas around another's geometry fails silently.
    public let config: CharacterConfig
    private let env: AvatarEnvironment
    private let scene: Scene
    private let store: Channels
    private let tweens: Tweens
    private let scheduler: Scheduler
    /// A CLASS, so this is the same object the reflexes hold — see "one PRNG
    /// object, shared" in the task notes. A copy here would fork the stream.
    private let prng: Prng
    private let arbiter: Arbiter
    private let reflexes: Reflexes
    private var started = false
    /// The host's timestamp at the first frame, and the engine's own clock —
    /// seconds since that frame. `tick`'s argument is the only time this engine
    /// ever reads; see "exactly one clock" in the task notes.
    private var origin: Double = 0
    private var clock: Double = 0

    public init(_ options: EngineOptions) throws {
        config = options.config
        env = options.env
        store = Channels()
        config.seed(into: store)
        scene = try Scene(config, variant: options.variant)
        tweens = Tweens(channels: store, respond: config.respond)
        scheduler = Scheduler()
        prng = Prng(seed: options.seed)

        let ctx = AnimContext(config: config, channels: store,
                              tweens: tweens, scheduler: scheduler)
        arbiter = Arbiter(ctx)

        // `arbiter` is fully formed before this, so the four closures can read it
        // without a two-phase dance. They are closures rather than a reference
        // because the reflexes must not be able to COMMAND the arbiter — the one
        // direction they may drive it is `say`, and `mutter` is that door.
        let a = arbiter
        let pick = { [config, prng] (mood: String?) -> String in
            Engine.pickSaying(config, prng, mood ?? a.state.mood)
        }
        reflexes = Reflexes(ReflexDeps(
            ctx: ctx,
            prng: prng,
            mood: { a.state.mood },
            reducedMotion: options.env.reducedMotion,
            mutter: { now in a.say(pick(nil), now: now) }))
    }

    /// Free of `self`, so the closure above can hold the two references it needs
    /// rather than the whole engine.
    ///
    /// Both force-unwraps are claims Task 29's invariant 11 backs: the loader
    /// refuses a config whose active mood has no saying list, and refuses any
    /// empty list, so neither the fallback nor `pick` can miss.
    private static func pickSaying(_ config: CharacterConfig,
                                   _ prng: Prng, _ mood: String) -> String {
        let all = config.sayings.sayings
        let lines = all[mood] ?? all[config.behavior.ladder.moods["active"]!]!
        return prng.pick(lines)
    }

    public func tick(_ now: Double) throws -> DisplayList {
        // Lazily, so the host's first frame time is the engine's origin and a
        // character constructed early does not age on a clock nobody read.
        if !started {
            started = true
            origin = now
            // ORDER: the arbiter registers first, so its ladder poll holds a
            // lower scheduler id than anything the reflexes arm and therefore
            // runs first on every tick. `reflexes.start` reads `mood()`; the
            // arbiter's `start` is what makes that true.
            arbiter.start(0)
            reflexes.start(0)
        }
        clock = now - origin
        // ORDER: make events due, let the arbiter consume them, sample the tweens
        // they added, then read the channels. Each swap is its own frame-late bug.
        scheduler.tick(clock)
        arbiter.tick(clock)
        tweens.tick(clock)
        return try scene.compose(store)
    }

    /// The app's declared mood, outranking the idle ladder; `nil` releases it.
    /// The only command that throws — `mood` is the one string reaching this
    /// engine that the loader never saw.
    public func setMood(_ mood: String?) throws { try arbiter.setMood(mood, now: clock) }

    public func notice() { arbiter.notice(clock) }
    public func look(_ x: Double, _ y: Double) { reflexes.look(x, y, now: clock) }
    public func poke() { arbiter.poke(clock) }
    public func say(_ text: String) { arbiter.say(text, now: clock) }

    /// Play a timeline by its name in `timelines.json`. Named, never `yawn()`:
    /// this package does not know what a yawn is.
    public func play(_ name: String) throws {
        _ = try playTimeline(AnimContext(config: config, channels: store,
                                         tweens: tweens, scheduler: scheduler),
                             name, now: clock)
    }

    public func randomSaying(_ mood: String? = nil) -> String {
        Engine.pickSaying(config, prng, mood ?? arbiter.state.mood)
    }

    public var state: ArbiterState { arbiter.state }

    /// For the golden recorder and tests. A host reads the display list.
    public var channels: Channels { store }
}
