/**
 * Everything the engine needs from the outside world, and nothing more.
 *
 * There is deliberately no `now()` here. The engine's only clock is the argument
 * to `tick`, so an environment that could report a *second*, unrelated time
 * would be an invitation to the bug Ruling 48 removed — the golden recorder
 * driving frames on scenario time while every command it scripted landed at the
 * environment's default of zero. One time source cannot disagree with itself.
 *
 * The one default left is deliberately the *inert* answer, so an engine
 * constructed with no environment at all still runs deterministically — which is
 * exactly what the golden recorder wants.
 */
export interface Environment {
  reducedMotion(): boolean;
}

export const defaultEnvironment: Environment = {
  reducedMotion: () => false,
};

/** Browser-backed environment. Hosts opt in; the engine core never imports it.
 *
 *  `matchMedia` is read off `globalThis` rather than named bare: this package's
 *  `tsconfig.json` deliberately scopes `lib` to `["ES2022"]` with no `DOM` (the
 *  engine core must never accidentally reach for a browser global), so the bare
 *  name has no type here. The indirection changes nothing at runtime — same
 *  guard, same call, same query string — it only gives TypeScript a type for a
 *  global this one function is allowed to use. */
export function browserEnvironment(): Environment {
  const matchMedia = (globalThis as {
    matchMedia?: (query: string) => { matches: boolean };
  }).matchMedia;
  return {
    reducedMotion: () =>
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}
