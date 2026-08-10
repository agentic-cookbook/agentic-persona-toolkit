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
});
