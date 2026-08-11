import { type FieldType, isFieldType } from './types';

/**
 * How wide an audience a value may reach, ordered LOOSEST → TIGHTEST.
 *
 * An ENUM rather than a boolean, and ordered rather than a bare set, because every
 * operation this feature needs is a comparison: a registrant may only TIGHTEN what the
 * registry owner allows, a read plane admits everything at or below the viewer's own
 * entitlement, and two settings combine by taking the tighter. A boolean can express none
 * of those, and an unordered set can express them only by re-deriving the order at each
 * call site.
 *
 * - `public` — anyone, signed in or not. This is what a search engine indexes.
 * - `authenticated` — any signed-in hub user. Not "members of this registry": a registry
 *   has no membership concept, and the hub's sign-in is the audience the platform can
 *   actually check.
 * - `private` — nobody on the public plane. The value is still stored and still returned
 *   by the owner-facing API to the people who own it: the registrant whose entry it is,
 *   and the registry's owner.
 *
 * Adding a fourth member is a two-line change here plus the compile errors it raises at
 * every exhaustive `Record<FieldVisibility, …>` — which is the point of writing the rank
 * as one.
 */
export const FIELD_VISIBILITIES = ['public', 'authenticated', 'private'] as const;
export type FieldVisibility = (typeof FIELD_VISIBILITIES)[number];

/**
 * The audience a given request is entitled to see.
 *
 * A subset of {@link FieldVisibility} rather than its own tuple, so the two can never
 * drift and `visibilityAdmits` can compare them on one scale. `private` is deliberately
 * NOT a viewer scope: no public-plane request is ever entitled to it. The people who may
 * read a private value reach it through the authenticated entry API, which returns the
 * stored `values` map whole and applies no visibility filter at all.
 */
export type ViewerScope = Extract<FieldVisibility, 'public' | 'authenticated'>;

/**
 * Position on the loose→tight scale. Exhaustive `Record` on purpose: a member added to
 * `FIELD_VISIBILITIES` without a rank is a compile error here rather than a silent
 * `undefined` that would make every comparison below answer `false`.
 */
const RANK: Record<FieldVisibility, number> = {
  public: 0,
  authenticated: 1,
  private: 2,
};

export function isFieldVisibility(value: unknown): value is FieldVisibility {
  return typeof value === 'string' && (FIELD_VISIBILITIES as readonly string[]).includes(value);
}

/** The tighter of two settings — the operation that combines a ceiling with an override. */
export function tightestVisibility(a: FieldVisibility, b: FieldVisibility): FieldVisibility {
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * May a viewer entitled to `viewer` see a value marked `field`?
 *
 * The whole read-side rule, in one comparison, so no caller re-derives it from the member
 * names. Note the direction: a LOWER rank is a WIDER audience, so admission is
 * `field <= viewer`, not the reverse.
 */
export function visibilityAdmits(field: FieldVisibility, viewer: ViewerScope): boolean {
  return RANK[field] <= RANK[viewer];
}

/**
 * Is `candidate` no LOOSER than `ceiling`?
 *
 * The write-side rule. The registry owner configures a field's visibility and that is a
 * CEILING; the registrant sets the value on their own entry and may only tighten it. A
 * registrant who could loosen would publish, to the whole internet, a field the owner
 * deliberately scoped to signed-in users.
 */
export function isWithinVisibility(candidate: FieldVisibility, ceiling: FieldVisibility): boolean {
  return RANK[candidate] >= RANK[ceiling];
}

/**
 * Every setting a registrant may choose for a field whose ceiling is `ceiling`, loosest
 * first — the option list for a per-field visibility picker.
 *
 * Derived from the same rank the server enforces with `isWithinVisibility`, so a picker
 * cannot offer a choice the server will reject. Always non-empty: the ceiling itself is
 * within itself.
 */
export function visibilitiesWithin(ceiling: FieldVisibility): FieldVisibility[] {
  return FIELD_VISIBILITIES.filter((v) => isWithinVisibility(v, ceiling));
}

/**
 * The field types whose values are a way to CONTACT a person rather than a way to describe
 * one: an email address, a phone number, a postal address.
 *
 * Not a ban — see {@link defaultVisibilityForType}. Publishing a business phone number is
 * a legitimate thing for a directory entry to do, and which of these a registry publishes
 * is the registry owner's call, not the platform's. What the platform owes is a default
 * that does not surprise: a field of one of these types starts scoped so that choosing to
 * publish it is a decision someone made, never one they inherited.
 */
export const CONTACT_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'email',
  'phone',
  'address',
]);

/**
 * The visibility a newly created field def starts at, given its type.
 *
 * Contact types start `private`; everything else starts `public`. This is the ONLY place
 * type influences visibility — once a def exists, its stored setting is the whole answer
 * and its type no longer enters into it.
 *
 * An unrecognized type gets the contact default, not the public one: a type this build
 * does not know about is a type whose values this build cannot characterize, and the
 * fail-closed answer to "should I publish this?" is no.
 */
export function defaultVisibilityForType(type: string): FieldVisibility {
  if (!isFieldType(type)) return 'private';
  return CONTACT_FIELD_TYPES.has(type) ? 'private' : 'public';
}
