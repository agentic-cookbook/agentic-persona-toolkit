import { describe, expect, it } from 'vitest';
import {
  FIELD_TYPES, coerceFieldValue, publishBlockers, searchableText, validateFieldValue,
} from '../index';
import type { FieldDefLike, FieldType } from '../index';

const def = (type: FieldType, extra: Partial<FieldDefLike> = {}): FieldDefLike => ({
  key: 'f',
  type,
  required: false,
  config: {},
  ...extra,
});

describe('the field-type catalog', () => {
  it('has exactly the twelve v1 types', () => {
    expect([...FIELD_TYPES].sort()).toEqual(
      [
        'address', 'boolean', 'date', 'email', 'image', 'markdown',
        'multi_select', 'phone', 'select', 'text', 'textarea', 'url',
      ].sort(),
    );
  });

  it('accepts an empty value on an optional field and rejects it on a required one', () => {
    expect(validateFieldValue(def('text'), '')).toBeNull();
    expect(validateFieldValue(def('text', { required: true }), '')).toBe('Required');
  });

  it('enforces maxLength from config on text', () => {
    expect(validateFieldValue(def('text', { config: { maxLength: 3 } }), 'abcd'))
      .toBe('Must be 3 characters or fewer');
    expect(validateFieldValue(def('text', { config: { maxLength: 3 } }), 'abc')).toBeNull();
  });

  it('rejects a url without an http(s) scheme', () => {
    expect(validateFieldValue(def('url'), 'example.com')).toBe('Must be a http(s) URL');
    expect(validateFieldValue(def('url'), 'https://example.com')).toBeNull();
  });

  it('rejects an email without a single @ and a dotted domain', () => {
    expect(validateFieldValue(def('email'), 'nope')).toBe('Must be an email address');
    expect(validateFieldValue(def('email'), 'a@b.co')).toBeNull();
  });

  it('rejects a select value outside its configured options', () => {
    const d = def('select', { config: { options: ['a', 'b'] } });
    expect(validateFieldValue(d, 'c')).toBe('Not one of the allowed options');
    expect(validateFieldValue(d, 'a')).toBeNull();
  });

  it('rejects a multi_select containing an unknown option', () => {
    const d = def('multi_select', { config: { options: ['a', 'b'] } });
    expect(validateFieldValue(d, ['a', 'z'])).toBe('Not one of the allowed options');
    expect(validateFieldValue(d, ['a', 'b'])).toBeNull();
  });

  it('rejects a date that is not ISO yyyy-mm-dd', () => {
    expect(validateFieldValue(def('date'), '03/04/2026')).toBe('Must be a date (YYYY-MM-DD)');
    expect(validateFieldValue(def('date'), '2026-03-04')).toBeNull();
  });

  it('coerces a boolean from its string form and a multi_select from a scalar', () => {
    expect(coerceFieldValue(def('boolean'), 'true')).toBe(true);
    expect(coerceFieldValue(def('boolean'), '')).toBe(false);
    expect(coerceFieldValue(def('multi_select'), 'a')).toEqual(['a']);
  });

  it('contributes text to the search index only for the text-bearing types', () => {
    expect(searchableText(def('text'), 'hello')).toBe('hello');
    expect(searchableText(def('multi_select'), ['a', 'b'])).toBe('a b');
    expect(searchableText(def('address'), { city: 'Seattle', country: 'US' })).toContain('Seattle');
    // An image is an attachment id and a boolean is a flag — neither is language.
    expect(searchableText(def('image'), 'att_123')).toBe('');
    expect(searchableText(def('boolean'), true)).toBe('');
  });

  it('withholds search text for a non-public field even when it is otherwise text-bearing', () => {
    // Defence in depth behind Task 4's indexer filter: entries.search_text is documented
    // (Task 1) as derived from public-visible values only. `visibility` is optional and
    // additive, so a caller that never passes it is unaffected.
    const priv = { ...def('text'), visibility: 'private' };
    expect(searchableText(priv, 'secret bio')).toBe('');
    const pub = { ...def('text'), visibility: 'public' };
    expect(searchableText(pub, 'public bio')).toBe('public bio');
    expect(searchableText(def('text'), 'no visibility field at all')).toBe('no visibility field at all');
  });

  it('fails closed on a field type the catalog does not recognize', () => {
    // Reachable at runtime even though FieldType is a 12-member union at compile time:
    // registry.field_defs.type is a bare varchar with no CHECK constraint (Task 1), so a
    // newer frontend catalog can write a 13th type before this backend is re-vendored.
    const unknown = def('rating' as FieldType, { required: false });
    expect(validateFieldValue(unknown, 'x')).toBe('Unrecognized field type');
    expect(coerceFieldValue(unknown, 'x')).toBeUndefined();
    expect(searchableText(unknown, 'x')).toBe('');
  });

  it('rejects a non-string value on every string-shaped type before it can be stringified', () => {
    const junk = { nested: [1, 2, 3] };
    for (const type of ['text', 'textarea', 'markdown', 'url', 'email', 'phone', 'date', 'select'] as const) {
      expect(validateFieldValue(def(type), junk)).toBe('Must be text');
    }
  });

  it('enforces a default length cap when the owner has not configured one', () => {
    // 255, not a round number: it matches the varchar(255) every single-line column in
    // this schema uses (registries.name, entries.displayName, field_defs.label, ...),
    // since this value is stored beside those columns.
    expect(validateFieldValue(def('text'), 'a'.repeat(256))).toBe('Must be 255 characters or fewer');
    expect(validateFieldValue(def('text'), 'a'.repeat(255))).toBeNull();
    expect(validateFieldValue(def('textarea'), 'a'.repeat(2001))).toBe('Must be 2000 characters or fewer');
    expect(validateFieldValue(def('markdown'), 'a'.repeat(20001))).toBe('Must be 20000 characters or fewer');
    expect(validateFieldValue(def('url'), `https://example.com/${'a'.repeat(3000)}`))
      .toBe('Must be 2048 characters or fewer');
    expect(validateFieldValue(def('email'), `${'a'.repeat(300)}@example.com`))
      .toBe('Must be 254 characters or fewer');
  });

  it('caps a multi_select at a sane item count and rejects a repeated selection', () => {
    const wideOpen = def('multi_select', {
      config: { options: Array.from({ length: 60 }, (_, i) => `o${i}`) },
    });
    const tooMany = Array.from({ length: 51 }, (_, i) => `o${i}`);
    expect(validateFieldValue(wideOpen, tooMany)).toBe('Must be 50 selections or fewer');

    const d = def('multi_select', { config: { options: ['a', 'b'] } });
    expect(validateFieldValue(d, ['a', 'a'])).toBe('Must not repeat a selection');
    expect(validateFieldValue(d, ['a', 'b'])).toBeNull();
  });

  it('overrides the multi_select item cap via config.maxItems, the maxLength analogue', () => {
    const capped = def('multi_select', { config: { maxItems: 2, options: ['a', 'b', 'c'] } });
    expect(validateFieldValue(capped, ['a', 'b', 'c'])).toBe('Must be 2 selections or fewer');
    expect(validateFieldValue(capped, ['a', 'b'])).toBeNull();
  });

  it('accepts a bare string on multi_select as the single-choice form-encoding it is', () => {
    const d = def('multi_select', { config: { options: ['a', 'b'] } });
    expect(validateFieldValue(d, 'a')).toBeNull();
    expect(coerceFieldValue(d, 'a')).toEqual(['a']);
    // Still runs the same options/dedupe/cap checks a real array would.
    expect(validateFieldValue(d, 'z')).toBe('Not one of the allowed options');
  });

  it('requires actual digits in a phone number, not just punctuation of the right length', () => {
    expect(validateFieldValue(def('phone'), '-------')).toBe('Must be a phone number');
    expect(validateFieldValue(def('phone'), '(((((((')).toBe('Must be a phone number');
    expect(validateFieldValue(def('phone'), '+1 555 123 4567')).toBeNull();
  });

  it('rejects an image value that is not an attachment id, and accepts one that is', () => {
    expect(validateFieldValue(def('image'), 'https://evil.example/beacon.gif'))
      .toBe('Must be an uploaded image');
    expect(validateFieldValue(def('image'), 'javascript:alert(1)')).toBe('Must be an uploaded image');
    expect(validateFieldValue(def('image'), 'att_123')).toBeNull();
  });

  it('projects an address coercion onto the declared keys and drops anything else', () => {
    const junky = { line1: '1 Main St', country: 'US', junk: { deep: [1, 2, 3] }, extra: 'nope' };
    expect(coerceFieldValue(def('address'), junky)).toEqual({ line1: '1 Main St', country: 'US' });
  });

  describe('the validate-then-coerce order contract', () => {
    // Models the order every caller MUST follow (see the docblock atop validate.ts):
    // validate first, and only coerce a value validation accepted. `stored` is unreachable
    // when validation rejects, by construction of this helper — which IS the contract,
    // not just an assertion about it.
    function attemptSave(d: FieldDefLike, value: unknown) {
      const error = validateFieldValue(d, value);
      if (error) return { ok: false as const, error };
      return { ok: true as const, stored: coerceFieldValue(d, value) };
    }

    const selectCfg = { config: { options: ['a', 'b'] } };

    interface TypeCase {
      extra?: Partial<FieldDefLike>;
      // Every wire form validateFieldValue must accept, paired with the EXACT value
      // coerceFieldValue must produce for it — a spot check of "is it defined" would stay
      // green for a coercer that returned the same placeholder for everything, which is
      // exactly how the round-1 boolean/multi_select mismatches slipped through here.
      accepted: { value: unknown; stored: unknown }[];
      // At least one wire form validateFieldValue must reject, so attemptSave's "a
      // rejected value never reaches the coercer" guarantee is exercised for real.
      rejected: unknown[];
    }

    // `Record<FieldType, TypeCase>` makes a missing row for a 13th FIELD_TYPES entry a
    // compile error; the explicit key-set assertion below makes it a RUNTIME test failure
    // too, so `pnpm test` catches it even where a type error alone might not.
    const table: Record<FieldType, TypeCase> = {
      text: {
        accepted: [
          { value: 'hello', stored: 'hello' },
          { value: '  padded  ', stored: 'padded' },
        ],
        rejected: [{ a: 1 }, 'a'.repeat(256)],
      },
      textarea: {
        accepted: [{ value: 'hi there', stored: 'hi there' }],
        rejected: [[1, 2]],
      },
      markdown: {
        accepted: [{ value: '# hi', stored: '# hi' }],
        rejected: [42],
      },
      select: {
        extra: selectCfg,
        accepted: [{ value: 'a', stored: 'a' }],
        rejected: ['z'],
      },
      multi_select: {
        extra: selectCfg,
        accepted: [
          { value: ['a'], stored: ['a'] },
          { value: ['a', 'b'], stored: ['a', 'b'] },
          // Standard form encoding, not sloppiness: a single-choice multi-select posts a
          // bare string, not a one-element array. `[value]` is its lossless
          // normalization, so validation must accept it (see the module docblock).
          { value: 'a', stored: ['a'] },
        ],
        rejected: [['a', 'z'], ['a', 'a']],
      },
      url: {
        accepted: [{ value: 'https://example.com', stored: 'https://example.com' }],
        rejected: ['example.com'],
      },
      email: {
        accepted: [{ value: 'a@b.co', stored: 'a@b.co' }],
        rejected: ['nope'],
      },
      phone: {
        accepted: [{ value: '+1 555 123 4567', stored: '+1 555 123 4567' }],
        rejected: ['-------'],
      },
      boolean: {
        accepted: [
          { value: true, stored: true },
          { value: false, stored: false },
          { value: 'true', stored: true },
          { value: 'false', stored: false },
          { value: '1', stored: true },
          { value: '0', stored: false },
          { value: 'on', stored: true },
          { value: 'off', stored: false },
        ],
        rejected: [5, 'yes'],
      },
      date: {
        accepted: [{ value: '2026-03-04', stored: '2026-03-04' }],
        rejected: ['03/04/2026'],
      },
      image: {
        accepted: [{ value: 'att_123', stored: 'att_123' }],
        rejected: [{ a: 1 }, 'https://evil.example/x.gif'],
      },
      address: {
        accepted: [
          { value: { country: 'US' }, stored: { country: 'US' } },
          { value: { line1: '1 Main St', junk: 'drop me' }, stored: { line1: '1 Main St' } },
        ],
        rejected: [{ country: 'usa' }],
      },
    };

    it('the wire-form table covers exactly the current field-type catalog', () => {
      expect(Object.keys(table).sort()).toEqual([...FIELD_TYPES].sort());
    });

    it.each(FIELD_TYPES.map((type) => [type, table[type]] as const))(
      '%s: accepts every listed wire form and coerces it EXACTLY; rejects the rest before the coercer runs',
      (type, { extra, accepted, rejected }) => {
        const d = def(type, extra);

        for (const { value, stored } of accepted) {
          const result = attemptSave(d, value);
          expect(result.ok, `expected ${type} to accept ${JSON.stringify(value)}`).toBe(true);
          if (result.ok) expect(result.stored).toEqual(stored);
        }

        for (const value of rejected) {
          const result = attemptSave(d, value);
          expect(result.ok, `expected ${type} to reject ${JSON.stringify(value)}`).toBe(false);
        }
      },
    );

    // Emptiness is decided by `required`, uniformly, before any type-shape check — applied
    // consistently across all twelve types here so a future type-specific special case
    // (like round 1's boolean carve-out, which broke this) fails this loop immediately.
    const EMPTY_STORED: Record<FieldType, unknown> = {
      text: '',
      textarea: '',
      markdown: '',
      url: '',
      email: '',
      phone: '',
      date: '',
      select: '',
      image: '',
      boolean: false,
      multi_select: [],
      address: {},
    };

    it.each(FIELD_TYPES)(
      '%s: an empty value is valid and coerces to the empty form when optional, and "Required" when required',
      (type) => {
        const optional = def(type, { required: false });
        expect(validateFieldValue(optional, '')).toBeNull();
        expect(coerceFieldValue(optional, '')).toEqual(EMPTY_STORED[type]);

        const required = def(type, { required: true });
        expect(validateFieldValue(required, '')).toBe('Required');
      },
    );
  });
});

describe('what blocks publish', () => {
  const req = (key: string, extra: Record<string, unknown> = {}) => ({
    ...def('text', { key, required: true }),
    label: key.toUpperCase(),
    ...extra,
  });

  it('lists a required field left blank, by label', () => {
    // By LABEL, because the checklist is read by the registrant, who never sees the key.
    expect(publishBlockers([req('bio')], {})).toEqual([{ key: 'bio', label: 'BIO' }]);
    expect(publishBlockers([req('bio')], { bio: 'hi' })).toEqual([]);
  });

  it('does not list a required field its show_if rule hides', () => {
    // There is no control for it on screen, so a blocker naming it could never be
    // cleared — the registrant would be stuck staring at a form with nothing to fill in.
    const gated = req('rate', { showIf: { field: 'paid', op: 'truthy', value: null } });
    expect(publishBlockers([gated], { paid: false })).toEqual([]);
    expect(publishBlockers([gated], { paid: true })).toEqual([{ key: 'rate', label: 'RATE' }]);
  });

  it('does not list a field the owner soft-deleted', () => {
    expect(publishBlockers([req('bio', { deletedAt: '2026-01-01T00:00:00Z' })], {})).toEqual([]);
  });

  it('counts `false` as an answer on a boolean', () => {
    // isEmpty's boolean carve-out, restated where it bites: a registrant who answered
    // "no" answered, and must not be told the field is still blank.
    const remote = { ...def('boolean', { key: 'remote', required: true }), label: 'Remote' };
    expect(publishBlockers([remote], { remote: false })).toEqual([]);
  });

  it('lists a required field whose value fails validation, not only ones left blank', () => {
    // An invalid-but-non-blank answer must block publish the same as a blank one — otherwise
    // a broken value reaches the public page for a field the checklist called satisfied.
    const site = { ...def('url', { key: 'site', required: true }), label: 'SITE' };
    expect(publishBlockers([site], { site: 'not-a-url' })).toEqual([{ key: 'site', label: 'SITE' }]);
    expect(publishBlockers([site], { site: 'https://example.com' })).toEqual([]);
  });
});
