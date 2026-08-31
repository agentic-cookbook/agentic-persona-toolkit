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
const TOKEN = /([MLCZ])|(-?\d*\.?\d+(?:e-?\d+)?)/gi;

export function parsePath(d: string): ParsedPath {
  if (/[^MLCZ\s,\-.0-9eE]/.test(d)) {
    throw new Error(`unsupported path command in: ${d}`);
  }

  const kind: string[] = [];
  const points: number[] = [];
  let pending: string | null = null;
  let need = 0;

  for (const m of d.matchAll(TOKEN)) {
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
