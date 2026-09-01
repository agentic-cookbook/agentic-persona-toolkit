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

    public var description: String {
        switch self {
        case .unsupported(let s): "unsupported path syntax in: \(s)"
        case .truncated(let s): "truncated command in path: \(s)"
        case .stray(let s): "stray number in path: \(s)"
        case .badPointCount(let s): s
        }
    }
}

private let arity: [Character: Int] = ["M": 2, "L": 2, "C": 6, "Z": 0]

/// Hand-rolled rather than regex: the grammar is four letters and a number and
/// the scanner is shorter than the pattern would be. It is NOT automatically in
/// agreement with the web's regex, and assuming it was hid two divergences:
/// web's guard admits `\s` (so CR passed there and threw here), and web's
/// tokeniser silently skips any character it fails to match (so `M5.,3` parsed
/// as `M5,3` there and threw here). Web now rejects every unconsumed character
/// that is not a separator, and the separator sets are the same five on both
/// sides. The `testAgreesWithTheWebOnTheWholeGrammar` corpus below is what keeps
/// that true.
public func parsePath(_ d: String) throws -> ParsedPath {
    var kind = ""
    var points: [Double] = []
    var need = 0
    var pending: Character?
    var number = ""

    func flushNumber() throws {
        guard !number.isEmpty else { return }
        guard pending != nil, need > 0 else { throw PathError.stray(d) }
        // `Double` accepts "5." and "5.e2"; web's number grammar requires a
        // digit after the decimal point. A number the two platforms disagree
        // about is a path they disagree about, and `.shape` channel values are
        // path strings that cross between them.
        if let dot = number.firstIndex(of: "."),
           dot == number.index(before: number.endIndex)
             || !("0"..."9").contains(number[number.index(after: dot)]) {
            throw PathError.unsupported(d)
        }
        guard let value = Double(number) else { throw PathError.unsupported(d) }
        points.append(value)
        number = ""
        need -= 1
        if need == 0 { pending = nil }
    }

    for ch in d {
        if ch.isNumber || ch == "." || ch == "-" || ch == "e" || ch == "E" {
            // A `-` or `e` only continues a number; anything else starts one.
            if ch == "-", !number.isEmpty, !(number.hasSuffix("e") || number.hasSuffix("E")) {
                try flushNumber()
            }
            if (ch == "e" || ch == "E"), number.isEmpty {
                throw PathError.unsupported(d)
            }
            number.append(ch)
            continue
        }
        try flushNumber()
        // Space, tab, CR, LF and comma — SVG's `wsp` set plus the comma the
        // emitter writes. CR is easy to forget and its absence was a real
        // divergence: web's guard tests `\s`, which admits it.
        if ch == " " || ch == "," || ch == "\n" || ch == "\t" || ch == "\r" { continue }
        guard let n = arity[ch] else { throw PathError.unsupported(d) }
        guard need == 0 else { throw PathError.truncated(d) }
        pending = ch
        need = n
        kind.append(ch)
        if n == 0 { pending = nil }
    }
    try flushNumber()
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
