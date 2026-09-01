import Foundation

/// A deliberately tiny SVG path grammar: absolute `M`, `L`, `C` and `Z`, comma
/// or space separated. `kind` is the command letters joined — "MLL",
/// "MCCCCZ" — and it is the whole morph-safety story: two paths interpolate
/// only when their kinds are equal, which makes anchor-to-anchor mapping
/// trivial and identical on every platform.
public struct ParsedPath: Equatable, Sendable {
    public var kind: String
    public var points: [Double]

    public init(kind: String, points: [Double]) {
        self.kind = kind
        self.points = points
    }
}

public enum PathError: Error, CustomStringConvertible {
    case unsupported(String)
    case truncated(String)
    case stray(String)
    case badPointCount(String)
    /// Distinct from `badPointCount`: a morph attempted across two paths whose
    /// `kind` differs, which is a shape-family mismatch, not a count mismatch.
    case shapeMismatch(String)

    public var description: String {
        switch self {
        case .unsupported(let s): "unsupported path syntax in: \(s)"
        case .truncated(let s): "truncated command in path: \(s)"
        case .stray(let s): "stray number in path: \(s)"
        case .badPointCount(let s): s
        case .shapeMismatch(let s): s
        }
    }
}

private let arity: [Character: Int] = ["M": 2, "L": 2, "C": 6, "Z": 0]

/// JS's `\d` (no `u` flag, as the web's `TOKEN` regex is written) matches only
/// ASCII 0-9 — Swift's `Character.isNumber`/`.isHexDigit` are Unicode-aware and
/// would also accept the fullwidth digit block (U+FF10-FF19), which is exactly
/// the class of divergence this port must not introduce. Every digit test in
/// this file goes through this, never through `Character.isNumber`.
private func isAsciiDigit(_ c: Character) -> Bool { c >= "0" && c <= "9" }

/// Scans one number token starting at `chars[i]`, mirroring the web's
/// `-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE]-?\d+)?` exactly — including where the
/// pattern's own optional groups refuse to extend a match. A decimal point
/// with no digit after it, or an `e`/`E` with no digit (after an optional
/// single `-`) after it, is left unconsumed rather than absorbed. That is what
/// makes "1.2.3" scan as two numbers ("1.2" then ".3", matching the web's
/// regex re-matching at the second dot) while "5.,3" and "5..3" both fail (the
/// lone "." belongs to neither number and is not a separator either). Returns
/// `nil` when no number starts at `i`, in which case nothing is consumed —
/// mirroring the regex reporting no match at that position, including
/// discarding a lone leading `-` that turned out not to lead a mantissa.
private func scanNumber(_ chars: [Character], _ start: Int) -> (value: Double, end: Int)? {
    var i = start
    var s = ""
    if i < chars.count, chars[i] == "-" { s.append("-"); i += 1 }

    var matchedMantissa = false
    if i < chars.count, isAsciiDigit(chars[i]) {
        let digitsStart = i
        while i < chars.count, isAsciiDigit(chars[i]) { i += 1 }
        s += String(chars[digitsStart..<i])
        matchedMantissa = true
        if i < chars.count, chars[i] == ".", i + 1 < chars.count, isAsciiDigit(chars[i + 1]) {
            s.append(".")
            i += 1
            let fracStart = i
            while i < chars.count, isAsciiDigit(chars[i]) { i += 1 }
            s += String(chars[fracStart..<i])
        }
    } else if i < chars.count, chars[i] == ".", i + 1 < chars.count, isAsciiDigit(chars[i + 1]) {
        s.append(".")
        i += 1
        let fracStart = i
        while i < chars.count, isAsciiDigit(chars[i]) { i += 1 }
        s += String(chars[fracStart..<i])
        matchedMantissa = true
    }
    guard matchedMantissa else { return nil }

    if i < chars.count, chars[i] == "e" || chars[i] == "E" {
        var j = i + 1
        var exp = ""
        if j < chars.count, chars[j] == "-" { exp.append("-"); j += 1 }
        if j < chars.count, isAsciiDigit(chars[j]) {
            let expStart = j
            while j < chars.count, isAsciiDigit(chars[j]) { j += 1 }
            exp += String(chars[expStart..<j])
            s.append(chars[i])
            s += exp
            i = j
        }
    }

    guard let value = Double(s) else { return nil }
    return (value, i)
}

/// A deliberately tiny scanner, not a regex engine — but `scanNumber` above
/// still has to reproduce the web's number regex's own backtracking-free
/// semantics exactly, because that regex is re-applied at every position
/// (`matchAll`, not an anchored per-token match), so it is what decides where
/// one number ends and the next begins with no separator required between
/// them.
public func parsePath(_ d: String) throws -> ParsedPath {
    let chars = Array(d)
    var kind = ""
    var points: [Double] = []
    var need = 0
    var pending: Character?
    var i = 0

    func isSeparator(_ c: Character) -> Bool {
        // Space, tab, CR, LF and comma — SVG's `wsp` set plus the comma the
        // emitter writes. CR is easy to forget: web's guard tests `\s`, which
        // admits it.
        c == " " || c == "," || c == "\n" || c == "\t" || c == "\r"
    }

    while i < chars.count {
        let ch = chars[i]
        if let n = arity[ch] {
            guard need == 0 else { throw PathError.truncated(d) }
            pending = ch
            need = n
            kind.append(ch)
            if n == 0 { pending = nil }
            i += 1
            continue
        }
        if let (value, end) = scanNumber(chars, i) {
            guard pending != nil, need > 0 else { throw PathError.stray(d) }
            points.append(value)
            need -= 1
            if need == 0 { pending = nil }
            i = end
            continue
        }
        guard isSeparator(ch) else { throw PathError.unsupported(d) }
        i += 1
    }
    guard need == 0 else { throw PathError.truncated(d) }
    return ParsedPath(kind: kind, points: points)
}

/// Round to 1e-6 and print `-0` as `0`, matching the web's `fmt` exactly.
/// Swift's default `Double` description would print "13.0" where JS prints
/// "13"; `%g`-style formatting would reintroduce exponents. This is the one
/// place both platforms must agree character-for-character.
func fmt(_ v: Double) -> String {
    let r = (v * 1e6).rounded() / 1e6
    if r == 0 { return "0" }
    if r == r.rounded(), abs(r) < 1e15 { return String(Int64(r)) }
    var s = String(format: "%.6f", r)
    while s.hasSuffix("0") { s.removeLast() }
    if s.hasSuffix(".") { s.removeLast() }
    return s
}

public func emitPath(_ p: ParsedPath) -> String {
    var out = ""
    var i = 0
    for letter in p.kind {
        let n = arity[letter] ?? 0
        let args = p.points[i..<(i + n)]
        i += n
        out += String(letter) + args.map(fmt).joined(separator: ",")
    }
    return out
}
