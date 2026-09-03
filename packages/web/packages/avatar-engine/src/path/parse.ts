/**
 * A deliberately tiny SVG path grammar: absolute M, L, C and Z, comma or space
 * separated. `kind` is the command letters joined — "MLL", "MCCCCZ" — and it is
 * the whole morph-safety story: two paths interpolate only when their kinds are
 * equal, which makes anchor-to-anchor mapping trivial and identical everywhere.
 */
export interface ParsedPath {
  kind: string;
  points: number[];
}

const ARITY: Record<string, number> = { M: 2, L: 2, C: 6, Z: 0 };

/**
 * A command letter, or a number. The number shape is deliberately strict: a
 * decimal point must have a digit after it, so `5.` and `5..3` are not numbers.
 * That is not pedantry about SVG — Swift's `Double("5.")` is 5.0 while
 * `Double("5..3")` is nil, so a looser token here would make the two platforms
 * disagree about the same string. No `i` flag: lowercase commands are rejected,
 * not tokenised and then failed one branch deeper.
 */
const TOKEN = /([MLCZ])|(-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE]-?\d+)?)/g;

/** Space, tab, CR, LF and comma — SVG's `wsp` set plus the comma `emitPath` writes. */
const SEPARATOR = /^[ \t\r\n,]*$/;

export function parsePath(d: string): ParsedPath {
  const kind: string[] = [];
  const points: number[] = [];
  let pending: string | null = null;
  let need = 0;
  let last = 0;

  /**
   * Everything between the previous token and this one must be separators.
   *
   * This is the whole acceptance gate, and it replaces a character-class guard
   * that could not do the job: `matchAll` SILENTLY SKIPS whatever it fails to
   * match, so any allowed-but-unmatched character simply vanished. `"M0,0-"`
   * and `"M0,0e"` parsed as a clean `[0, 0]` on web while Swift's scanner —
   * which sees every character in turn — threw. Rejecting the gaps closes that
   * class of divergence at its source rather than one character at a time, and
   * it subsumes the old guard: an arc's `A`, a `Q`, a `+`, a lowercase `m` are
   * all just characters no token consumed.
   */
  const gap = (upto: number): void => {
    if (!SEPARATOR.test(d.slice(last, upto))) {
      throw new Error(`unsupported path syntax in: ${d}`);
    }
  };

  for (const m of d.matchAll(TOKEN)) {
    gap(m.index);
    last = m.index + m[0].length;
    if (m[1] !== undefined) {
      const letter = m[1];
      if (need > 0) throw new Error(`truncated ${pending} in path: ${d}`);
      pending = letter;
      need = ARITY[letter]!;
      kind.push(letter);
      if (need === 0) pending = null;
    } else {
      if (pending === null) throw new Error(`stray number in path: ${d}`);
      points.push(Number(m[2]));
      need -= 1;
      if (need === 0) pending = null;
    }
  }
  gap(d.length);
  if (need > 0) throw new Error(`truncated ${pending} in path: ${d}`);
  return { kind: kind.join(""), points };
}

/**
 * Round to 1e-6 and print `-0` as `0`. Exported and imported by `./build`
 * rather than copied there: this is the one function both platforms must agree
 * on character-for-character (`ParsedPath.swift`'s `fmt` says so), and two
 * copies of it is two places for that agreement to lapse.
 *
 * HALF-AWAY-FROM-ZERO, matching Swift's `Double.rounded()`. `Math.round` is
 * half-toward-+Infinity, which agrees on every positive half-step and disagrees
 * on every negative one — `Math.round(-1.5)` is -1 where `(-1.5).rounded()` is
 * -2, so `fmt(-187.0000005)` emitted "-187" here and "-187.000001" there. Only
 * negatives diverge, which is why nothing caught it: `morph`'s `back.out`
 * easings EXTRAPOLATE past t=1, and that is the route to a negative coordinate.
 */
export const fmt = (v: number): string => {
  const scaled = v * 1e6;
  const r = (scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)) / 1e6;
  if (r === 0) return "0";                       // `-0` included
  const s = String(r);
  if (!s.includes("e")) return s;
  // SVG path data has no exponent form, and Swift's `%.6f` never emits one.
  // `String` reaches for one below 1e-6 — unreachable on this grid, whose
  // smallest non-zero value IS 1e-6 — and at 1e21, which a runaway coordinate
  // can reach and where `toFixed` gives up too. Every double that large is an
  // integer, so `BigInt` prints it in full, which is what Swift's `%.6f` does.
  return Math.abs(r) >= 1e21
    ? BigInt(r).toString()
    : r.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
};

export function emitPath(p: ParsedPath): string {
  let i = 0;
  let out = "";
  for (const letter of p.kind) {
    const n = ARITY[letter]!;
    const args = p.points.slice(i, i + n);
    i += n;
    out += letter + args.map(fmt).join(",");
  }
  return out;
}
