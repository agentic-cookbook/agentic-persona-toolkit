import Foundation

/// xoshiro128** — 32-bit state, 32-bit output, spec'd down to the integer ops
/// so Swift and TypeScript produce the identical stream.
///
/// Two rules make it deterministic across platforms and refresh rates:
///  - every step stays inside `UInt32` (`&+`, `&*` wrap, exactly as the web's
///    `>>> 0` forces the same wrap);
///  - the engine draws from it ONLY at scheduled events, never per tick. A
///    120 Hz display must consume exactly the same numbers as a 60 Hz one.
///
/// The seed is expanded with splitmix32 so a small seed (1, 2, 3) still fills
/// the state; an all-zero state is a fixed point and is stepped away from.
public final class Prng {
    private var s0: UInt32
    private var s1: UInt32
    private var s2: UInt32
    private var s3: UInt32

    public init(seed: UInt32) {
        var a = seed
        func splitmix32() -> UInt32 {
            a = a &+ 0x9e37_79b9
            var t = a
            t = (t ^ (t >> 15)) &* 0x85eb_ca6b
            t = (t ^ (t >> 13)) &* 0xc2b2_ae35
            return t ^ (t >> 16)
        }
        s0 = splitmix32()
        s1 = splitmix32()
        s2 = splitmix32()
        s3 = splitmix32()
        if (s0 | s1 | s2 | s3) == 0 { s0 = 1 }
    }

    private static func rotl(_ x: UInt32, _ k: UInt32) -> UInt32 {
        (x << k) | (x >> (32 - k))
    }

    public func next() -> UInt32 {
        let result = Self.rotl(s1 &* 5, 7) &* 9
        let t = s1 << 9
        s2 ^= s0
        s3 ^= s1
        s1 ^= s2
        s0 ^= s3
        s2 ^= t
        s3 = Self.rotl(s3, 11)
        return result
    }

    public func float() -> Double { Double(next()) / 4_294_967_296 }

    public func range(_ lo: Double, _ hi: Double) -> Double {
        lo + float() * (hi - lo)
    }

    public func pick<T>(_ items: [T]) -> T {
        items[Int(float() * Double(items.count))]
    }

    public func chance(_ p: Double) -> Bool { float() < p }

    /// `(float()*2-1)*m` — the original implementation's `rnd`.
    public func signed(_ m: Double) -> Double { (float() * 2 - 1) * m }
}
