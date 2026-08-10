/**
 * Call order is a contract, not a suggestion: **always `validateFieldValue` before
 * `coerceFieldValue`.**
 *
 * Validation is a check on what the caller actually sent. Coercion normalizes input that
 * has ALREADY been accepted — it is not a second validation pass, and will silently mangle
 * a value validation should have rejected: an `image` value that is an object stringifies
 * to `"[object Object]"` instead of failing; a `def.type` this catalog does not recognize
 * has no safe coercion at all (see the `isFieldType` guards below).
 *
 * The precise rule each validator follows: accept exactly those wire forms for which the
 * matching coercer produces a MEANINGFUL, NON-LOSSY normalization, and reject every other
 * value. "The coercer has a branch for it" is NOT that test — every coercer here is total,
 * so every input has some branch; the test is whether that branch's output is a faithful
 * reading of what was sent, not an invention. Two concrete consequences, both load-bearing:
 * `''` on a `boolean` field means "no answer" — coercing it to `false` is faithful only
 * because emptiness is checked against `required` (the SAME rule every other type follows)
 * before the type-shape switch below ever runs, so a required boolean left blank still
 * reads "Required", never "Must be true or false". And a bare string on `multi_select` is
 * exactly what a single-choice form field posts (standard form encoding, not a malformed
 * request) — `[value]` is its lossless normalization, so the validator accepts it and
 * applies the same options/dedupe/cap checks it applies to an array. Where the coercer
 * would have to invent or discard information instead — an `image` value that is an
 * object, a `multi_select` string outside its configured options — the validator rejects.
 * Tasks 3-5: call them in this order, every time.
 */
import { isFieldType } from './types';
import type { AddressValue, FieldDefLike, FieldType } from './types';
// `publishBlockers` below needs the rule evaluator. In the source package this is an
// ordinary import; in the backend's single-file vendored build the two files are
// concatenated with show-if.ts LAST, and the call still resolves because
// `evaluateShowIf` is a hoisted function declaration.
import { evaluateShowIf, type ShowIfRule } from './show-if';

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Deliberately permissive on shape: digits, spaces and the usual punctuation, 7-24
// characters total. Phone formats vary enough by country that a strict pattern rejects
// valid numbers. The digit count is checked separately below (see `countDigits`) — this
// regex alone would accept a string of nothing but punctuation, which is not a phone number.
const PHONE_RE = /^[+]?[\d\s().-]{7,24}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// The value is an attachment id minted by the presigned upload flow, not an arbitrary
// string — every id in this system is a varchar(36). Rejecting anything else here is what
// stops a public profile from ever holding a `javascript:` payload or a third-party URL in
// a field a later renderer might trust as "just an id" and interpolate unescaped.
const IMAGE_ID_RE = /^[A-Za-z0-9_-]{1,36}$/;

// Default length caps, applied only when the owner hasn't set `config.maxLength`. These
// are an abuse/DoS backstop, not a UX constraint — chosen so a genuine directory-entry
// answer never comes close: a name or title (text, matching the `varchar(255)` every
// single-line column in this schema uses — `registries.name`, `entries.displayName`,
// `entries.locationText`, `field_defs.label` — since a headline or one-line specialties
// list can plausibly run 150-250 characters and this value is stored beside those
// columns), a short free-text answer (textarea), a long-form "about" section (markdown),
// the longest URL most servers still accept in practice (url, matching the de facto ~2KB
// ceiling many proxies enforce), and RFC 5321's mailbox length limit (email).
const DEFAULT_MAX_LENGTH: Partial<Record<FieldType, number>> = {
  text: 255,
  textarea: 2000,
  markdown: 20000,
  url: 2048,
  email: 254,
};
// A generous tag/category list — comfortably more than any legitimate directory field asks
// a registrant to pick — while still bounding the array a hostile submission could send.
// Applied only when the owner hasn't set `config.maxItems` (the multi_select analogue of
// `config.maxLength` above; same ad-hoc `config` bag, same override pattern).
const MULTI_SELECT_MAX_ITEMS = 50;

const BOOLEAN_TRUE = new Set(['true', '1', 'on']);
const BOOLEAN_FALSE = new Set(['false', '0', 'off']);

// The eight types whose value is fundamentally a string. A number, array, or object is
// never a valid instance of one of these — without this guard `asString` below would
// silently stringify it ("[object Object]", "1,2") and validation would wave a mangled
// value through instead of rejecting it.
const STRING_LIKE_TYPES: ReadonlySet<FieldType> = new Set([
  'text',
  'textarea',
  'markdown',
  'url',
  'email',
  'phone',
  'date',
  'select',
]);

const ADDRESS_KEYS = ['line1', 'line2', 'city', 'region', 'postalCode', 'country'] as const;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function options(def: FieldDefLike): string[] {
  const raw = def.config.options;
  return Array.isArray(raw) ? raw.filter((o): o is string => typeof o === 'string') : [];
}

/**
 * Emptiness is a wire-level judgment, decided the SAME way for every type, before any
 * type-shape check runs: `null`/`undefined`, an empty or whitespace-only string, an empty
 * array, and an empty plain object all mean "nothing was submitted." `required` is the only
 * thing that then decides whether that is acceptable — never the type. A real value that
 * merely LOOKS falsy, `false` or `0`, is not empty: `asString` renders it as the non-blank
 * string `'false'`/`'0'`, so it falls through to the final line as a value, not an absence.
 * (An earlier version of this function special-cased `boolean` to never be empty, which
 * also — accidentally — made `''` on a boolean field skip the `required` gate entirely and
 * fall into the type-shape switch, where nothing recognized it: see the module docblock.)
 */
function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return asString(value).trim() === '';
}

function countDigits(text: string): number {
  return (text.match(/\d/g) ?? []).length;
}

/** Returns an error string, or null when the value is acceptable. */
export function validateFieldValue(def: FieldDefLike, value: unknown): string | null {
  if (!isFieldType(def.type)) {
    // Reachable at runtime even though `FieldType` is a closed union at compile time:
    // `registry.field_defs.type` is a bare varchar with no CHECK constraint (Task 1), so a
    // def written by a newer frontend catalog can carry a type this backend was vendored
    // before it knew about. TypeScript's exhaustive switch below only guarantees the
    // *known* branches are complete — it says nothing about data that never matches one.
    return 'Unrecognized field type';
  }

  if (isEmpty(value)) return def.required ? 'Required' : null;

  if (STRING_LIKE_TYPES.has(def.type) && typeof value !== 'string') {
    return 'Must be text';
  }

  const max = typeof def.config.maxLength === 'number' ? def.config.maxLength : null;
  const text = asString(value);

  switch (def.type) {
    case 'text':
    case 'textarea':
    case 'markdown': {
      const cap = max ?? DEFAULT_MAX_LENGTH[def.type];
      if (cap != null && text.length > cap) return `Must be ${cap} characters or fewer`;
      return null;
    }

    case 'url': {
      if (!URL_RE.test(text)) return 'Must be a http(s) URL';
      const cap = max ?? DEFAULT_MAX_LENGTH.url;
      if (cap != null && text.length > cap) return `Must be ${cap} characters or fewer`;
      return null;
    }

    case 'email': {
      if (!EMAIL_RE.test(text)) return 'Must be an email address';
      const cap = max ?? DEFAULT_MAX_LENGTH.email;
      if (cap != null && text.length > cap) return `Must be ${cap} characters or fewer`;
      return null;
    }

    case 'phone': {
      if (!PHONE_RE.test(text)) return 'Must be a phone number';
      const digits = countDigits(text);
      if (digits < 7 || digits > 20) return 'Must be a phone number';
      return null;
    }

    case 'date':
      if (!DATE_RE.test(text)) return 'Must be a date (YYYY-MM-DD)';
      if (Number.isNaN(Date.parse(text))) return 'Must be a date (YYYY-MM-DD)';
      return null;

    case 'boolean':
      if (typeof value === 'boolean') return null;
      if (typeof value === 'string' && (BOOLEAN_TRUE.has(value) || BOOLEAN_FALSE.has(value))) {
        return null;
      }
      return 'Must be true or false';

    case 'select': {
      const allowed = options(def);
      if (allowed.length > 0 && !allowed.includes(text)) return 'Not one of the allowed options';
      return null;
    }

    case 'multi_select': {
      // A bare string is a real wire form, not a malformed one: a form-encoded
      // multi-select with exactly one option checked posts that option as a scalar, the
      // same way a single <select> or checkbox does — the array form only appears once
      // two or more boxes are checked. `[value]` is that scalar's lossless
      // normalization, so it is accepted here and run through the same
      // options/dedupe/cap checks as an array, rather than rejected as "Must be a list".
      const list: unknown[] | null = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? [value]
          : null;
      if (list === null) return 'Must be a list';
      const maxItems = typeof def.config.maxItems === 'number' ? def.config.maxItems : MULTI_SELECT_MAX_ITEMS;
      if (list.length > maxItems) return `Must be ${maxItems} selections or fewer`;
      const strs = list.map(asString);
      if (new Set(strs).size !== strs.length) return 'Must not repeat a selection';
      const allowed = options(def);
      if (allowed.length > 0 && !strs.every((v) => allowed.includes(v))) {
        return 'Not one of the allowed options';
      }
      return null;
    }

    case 'image':
      // The value is an attachment id from the presigned upload flow, not an arbitrary
      // string — the upload route validates content type and size, this validates shape.
      if (typeof value !== 'string' || !IMAGE_ID_RE.test(value)) return 'Must be an uploaded image';
      return null;

    case 'address': {
      if (typeof value !== 'object' || Array.isArray(value)) return 'Must be an address';
      const a = value as AddressValue;
      if (a.country != null && a.country !== '' && a.country.length !== 2) {
        return 'Country must be a two-letter code';
      }
      return null;
    }
  }
}

/** Normalizes an ALREADY-VALID submitted value to the shape stored in `entries.values`. */
export function coerceFieldValue(def: FieldDefLike, value: unknown): unknown {
  if (!isFieldType(def.type)) {
    // No safe value to coerce to — an unrecognized type carries no known storage shape.
    // `validateFieldValue` rejects this def before any compliant caller reaches this line
    // (see the module docblock), so this is a second line of defence, not the primary gate.
    return undefined;
  }

  switch (def.type) {
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return value === 'true' || value === '1' || value === 'on';
    case 'multi_select':
      if (Array.isArray(value)) return value.map(asString);
      return isEmpty(value) ? [] : [asString(value)];
    case 'address': {
      if (typeof value !== 'object' || value == null || Array.isArray(value)) return {};
      const src = value as Record<string, unknown>;
      const out: AddressValue = {};
      for (const key of ADDRESS_KEYS) {
        const v = src[key];
        if (typeof v === 'string') out[key] = v;
      }
      return out;
    }
    case 'text':
    case 'textarea':
    case 'markdown':
    case 'url':
    case 'email':
    case 'phone':
    case 'date':
    case 'select':
    case 'image':
      return asString(value).trim();
  }
}

/**
 * The text this value contributes to `search_text`.
 *
 * Types that are not language contribute nothing: an image is an attachment id, a
 * boolean is a flag, and indexing either only pollutes ranking.
 *
 * `visibility` is optional and additive — most callers never had a notion of it, and a
 * plain `FieldDefLike` still satisfies this signature. When it IS present and not
 * `'public'`, this returns `''` unconditionally. `entries.search_text` is schema-documented
 * (Task 1) as derived from publicly-visible values only; Task 4's indexer is the primary
 * filter for that, and this is defence in depth — a private value should never reach the
 * search index even if a future caller forgets to filter it out first.
 */
export function searchableText(def: FieldDefLike & { visibility?: string }, value: unknown): string {
  // Same reasoning as the `isFieldType` guards in `validateFieldValue`/`coerceFieldValue`
  // above: an unrecognized type has no known text shape to extract, so it contributes
  // nothing rather than guessing.
  if (!isFieldType(def.type)) return '';
  if (def.visibility != null && def.visibility !== 'public') return '';

  switch (def.type) {
    case 'text':
    case 'textarea':
    case 'markdown':
    case 'select':
      return asString(value).trim();
    case 'multi_select':
      return Array.isArray(value) ? value.map(asString).join(' ').trim() : '';
    case 'address': {
      if (typeof value !== 'object' || value == null || Array.isArray(value)) return '';
      const a = value as AddressValue;
      return [a.city, a.region, a.country].filter(Boolean).join(' ').trim();
    }
    case 'url':
    case 'email':
    case 'phone':
    case 'boolean':
    case 'date':
    case 'image':
      return '';
  }
}

/**
 * A required field that stands between this entry and `published` — either left blank, or
 * answered with a value `validateFieldValue` rejects. The shape carries no flag telling the
 * two apart; see `publishBlockers` below for why.
 */
export interface PublishBlocker {
  key: string;
  label: string;
}

/**
 * Every required field the entry is blocked on — what stands between it and `published`.
 * That is either a blank answer, OR a present-but-invalid one (the same rule
 * `validateFieldValue` enforces): a registrant who typed an unparsable URL into a required
 * field has not usefully answered it, and letting that publish would put a broken value on
 * the public page for a field the checklist told them was satisfied.
 *
 * **`required` gates PUBLISH, not save.** The owner-defined form can run to dozens of
 * fields across several sections, and spec §13 saves those sections INDEPENDENTLY — so a
 * save that enforced `required` across the whole form would reject the first section a
 * registrant writes, citing fields in sections they have not opened yet. The server
 * therefore enforces this list only on the write that publishes, and the entry editor
 * renders the same list as its checklist, so the two can never disagree about what is
 * missing.
 *
 * A list rather than a percentage, for the same reason: spec §13 asks for "a discrete
 * checklist of what is still blocking publish", which is something a registrant can act
 * on one row at a time.
 *
 * A field its `show_if` rule hides is never blocking — the registrant has no control for
 * it on screen, so it could never be cleared.
 */
export function publishBlockers(
  defs: readonly (FieldDefLike & {
    label?: string;
    deletedAt?: string | null;
    showIf?: ShowIfRule | null;
  })[],
  values: Record<string, unknown>,
): PublishBlocker[] {
  return defs
    .filter((def) => {
      if (def.deletedAt) return false;
      if (!def.required) return false;
      if (!evaluateShowIf(def, values)) return false;
      const value = values[def.key];
      if (isEmpty(value)) return true;
      return validateFieldValue(def, value) != null;
    })
    .map((def) => ({ key: def.key, label: def.label ?? def.key }));
}
