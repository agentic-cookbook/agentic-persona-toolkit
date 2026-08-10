import type { AddressValue, FieldDefLike } from './types';
// `publishBlockers` below needs the rule evaluator. In the source package this is an
// ordinary import; in the backend's single-file vendored build the two files are
// concatenated with show-if.ts LAST, and the call still resolves because
// `evaluateShowIf` is a hoisted function declaration.
import { evaluateShowIf, type ShowIfRule } from './show-if';

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Deliberately permissive: digits, spaces and the usual punctuation, 7-20 digits. Phone
// formats vary enough by country that a strict pattern rejects valid numbers.
const PHONE_RE = /^[+]?[\d\s().-]{7,24}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function options(def: FieldDefLike): string[] {
  const raw = def.config.options;
  return Array.isArray(raw) ? raw.filter((o): o is string => typeof o === 'string') : [];
}

function isEmpty(def: FieldDefLike, value: unknown): boolean {
  if (value == null) return true;
  if (def.type === 'boolean') return false; // `false` is a value, not an absence
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return asString(value).trim() === '';
}

/** Returns an error string, or null when the value is acceptable. */
export function validateFieldValue(def: FieldDefLike, value: unknown): string | null {
  if (isEmpty(def, value)) return def.required ? 'Required' : null;

  const max = typeof def.config.maxLength === 'number' ? def.config.maxLength : null;
  const text = asString(value);

  switch (def.type) {
    case 'text':
    case 'textarea':
    case 'markdown':
      if (max != null && text.length > max) return `Must be ${max} characters or fewer`;
      return null;

    case 'url':
      if (!URL_RE.test(text)) return 'Must be a http(s) URL';
      return null;

    case 'email':
      if (!EMAIL_RE.test(text)) return 'Must be an email address';
      return null;

    case 'phone':
      if (!PHONE_RE.test(text)) return 'Must be a phone number';
      return null;

    case 'date':
      if (!DATE_RE.test(text)) return 'Must be a date (YYYY-MM-DD)';
      if (Number.isNaN(Date.parse(text))) return 'Must be a date (YYYY-MM-DD)';
      return null;

    case 'boolean':
      if (typeof value !== 'boolean') return 'Must be true or false';
      return null;

    case 'select': {
      const allowed = options(def);
      if (allowed.length > 0 && !allowed.includes(text)) return 'Not one of the allowed options';
      return null;
    }

    case 'multi_select': {
      if (!Array.isArray(value)) return 'Must be a list';
      const allowed = options(def);
      if (allowed.length > 0 && !value.every((v) => allowed.includes(asString(v)))) {
        return 'Not one of the allowed options';
      }
      return null;
    }

    case 'image':
      // The value is an attachment id from the presigned upload flow; the upload route
      // is what validates content type and size, so there is nothing left to check here.
      if (typeof value !== 'string') return 'Must be an uploaded image';
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

/** Normalizes a submitted value to the shape stored in `entries.values`. */
export function coerceFieldValue(def: FieldDefLike, value: unknown): unknown {
  switch (def.type) {
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return value === 'true' || value === '1' || value === 'on';
    case 'multi_select':
      if (Array.isArray(value)) return value.map(asString);
      return isEmpty(def, value) ? [] : [asString(value)];
    case 'address':
      return typeof value === 'object' && value != null && !Array.isArray(value) ? value : {};
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
 */
export function searchableText(def: FieldDefLike, value: unknown): string {
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

/** A required field this entry has not answered yet. */
export interface PublishBlocker {
  key: string;
  label: string;
}

/**
 * Every required field the entry has left blank — what stands between it and
 * `published`.
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
    .filter(
      (def) =>
        !def.deletedAt &&
        def.required &&
        evaluateShowIf(def, values) &&
        isEmpty(def, values[def.key]),
    )
    .map((def) => ({ key: def.key, label: def.label ?? def.key }));
}
