import { describe, expect, it } from 'vitest';
import { SHOW_IF_OPS, evaluateShowIf } from '../show-if';

const rule = (over: Partial<{ field: string; op: string; value: unknown }> = {}) => ({
  showIf: { field: 'mode', op: 'eq', value: 'paid', ...over },
});

describe('evaluateShowIf', () => {
  it('shows a field with no rule', () => {
    expect(evaluateShowIf({}, {})).toBe(true);
    expect(evaluateShowIf({ showIf: null }, {})).toBe(true);
  });

  it('compares eq and ne against the referenced value', () => {
    expect(evaluateShowIf(rule(), { mode: 'paid' })).toBe(true);
    expect(evaluateShowIf(rule(), { mode: 'free' })).toBe(false);
    expect(evaluateShowIf(rule({ op: 'ne' }), { mode: 'free' })).toBe(true);
    expect(evaluateShowIf(rule({ op: 'ne' }), { mode: 'paid' })).toBe(false);
  });

  it('treats an absent referenced value as absent, not as a match', () => {
    // The registrant has not answered the controlling question yet. Showing the dependent
    // field then is how a form asks about billing before it has been told there is a fee.
    expect(evaluateShowIf(rule(), {})).toBe(false);
  });

  it('supports truthy and falsy for a checkbox controller', () => {
    expect(evaluateShowIf(rule({ op: 'truthy' }), { mode: true })).toBe(true);
    expect(evaluateShowIf(rule({ op: 'truthy' }), { mode: false })).toBe(false);
    expect(evaluateShowIf(rule({ op: 'truthy' }), { mode: '' })).toBe(false);
    expect(evaluateShowIf(rule({ op: 'falsy' }), { mode: false })).toBe(true);
  });

  it('supports in for a select controller and contains for a multiselect one', () => {
    expect(evaluateShowIf(rule({ op: 'in', value: ['a', 'b'] }), { mode: 'b' })).toBe(true);
    expect(evaluateShowIf(rule({ op: 'in', value: ['a', 'b'] }), { mode: 'c' })).toBe(false);
    expect(evaluateShowIf(rule({ op: 'contains', value: 'a' }), { mode: ['a', 'z'] })).toBe(true);
    expect(evaluateShowIf(rule({ op: 'contains', value: 'a' }), { mode: ['z'] })).toBe(false);
  });

  it('compares scalars by value, not by reference', () => {
    // `in` and `eq` both run through the same comparison, so an array value on either side
    // must not fall back to identity — two equal arrays from two fetches are different objects.
    expect(evaluateShowIf(rule({ value: ['a'] }), { mode: ['a'] })).toBe(true);
  });

  it('shows the field when the op is one it does not know', () => {
    // Fail OPEN, deliberately. This predicate decides whether a control is on screen and
    // whether `required` applies; a rule this build cannot read is a rule from a newer
    // builder, and hiding the field would silently drop the registrant's data instead of
    // showing them something they can answer.
    expect(evaluateShowIf(rule({ op: 'matches-regex' }), { mode: 'anything' })).toBe(true);
  });

  it('fails open on a malformed in rule the same way it does on an unknown op', () => {
    // A scalar `value` on an `in` rule is a malformed rule, not a "no match" — the field
    // must stay visible for the same reason an unrecognized op does (see the test above).
    expect(evaluateShowIf(rule({ op: 'in', value: 'not-an-array' }), { mode: 'anything' })).toBe(true);
  });

  it('names exactly the ops a builder may offer', () => {
    // The builder renders one option per entry. A seventh op added here without a case in
    // the switch would fail open on every entry that used it.
    expect([...SHOW_IF_OPS]).toEqual(['eq', 'ne', 'truthy', 'falsy', 'in', 'contains']);
  });

  it('compares eq and ne against an object-shaped controller value (e.g. address) by structure, not reference', () => {
    // Round 3, I3: two field-for-field identical address values fetched independently are
    // different object references. Before this fix, `eq` fell back to `===` and could
    // never match one against the other — hiding the dependent field permanently and
    // silently, exactly what evaluateShowIf's own fail-open policy (see the 'in' case and
    // the module docblock) exists to prevent for a rule this build cannot interpret. An
    // object comparison should not BE uninterpretable, so this makes it not be.
    const home = { line1: '1 Main St', city: 'Seattle', country: 'US' };
    const sameHomeAgain = { line1: '1 Main St', city: 'Seattle', country: 'US' };
    const otherHome = { line1: '1 Main St', city: 'Portland', country: 'US' };

    expect(evaluateShowIf(rule({ op: 'eq', value: home }), { mode: sameHomeAgain })).toBe(true);
    expect(evaluateShowIf(rule({ op: 'eq', value: home }), { mode: otherHome })).toBe(false);
    expect(evaluateShowIf(rule({ op: 'ne', value: home }), { mode: sameHomeAgain })).toBe(false);
    expect(evaluateShowIf(rule({ op: 'ne', value: home }), { mode: otherHome })).toBe(true);
  });

  it('compares nested objects by structure at every level, not just the top one', () => {
    const nested = { a: { b: { c: [1, 2, { d: 'deep' }] } } };
    const sameShapeAgain = { a: { b: { c: [1, 2, { d: 'deep' }] } } };
    const differsOnlyDeepInside = { a: { b: { c: [1, 2, { d: 'different' }] } } };

    expect(evaluateShowIf(rule({ op: 'eq', value: nested }), { mode: sameShapeAgain })).toBe(true);
    expect(evaluateShowIf(rule({ op: 'eq', value: nested }), { mode: differsOnlyDeepInside })).toBe(false);
  });
});
