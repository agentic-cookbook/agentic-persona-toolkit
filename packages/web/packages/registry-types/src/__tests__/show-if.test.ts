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

  it('names exactly the ops a builder may offer', () => {
    // The builder renders one option per entry. A seventh op added here without a case in
    // the switch would fail open on every entry that used it.
    expect([...SHOW_IF_OPS]).toEqual(['eq', 'ne', 'truthy', 'falsy', 'in', 'contains']);
  });
});
