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

const fmt = (v: number): string => {
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? "0" : String(r);
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
