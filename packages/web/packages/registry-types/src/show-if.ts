/**
 * The one evaluator for a field's `show_if` rule.
 *
 * `show_if` is DATA, never a closure (spec §7): a builder UI can author `{field, op, value}`
 * and cannot author a function. Three callers run this same rule — the entry editor, to
 * decide what to render; the public profile renderer, to decide what to show; and the
 * server, to decide whether `required` applies at all.
 *
 * That third caller is why this lives beside the validators rather than in a UI package. A
 * required field the rule hides is a field the registrant has no control for, so a server
 * that enforced `required` blindly would reject every save with nothing on screen to fix.
 */

/** The rule as stored. `null` (or absent) means the field always applies. */
export interface ShowIfRule {
  field: string;
  op: string;
  value: unknown;
}

/** The ops a builder may author. Anything else fails open — see `evaluateShowIf`. */
export const SHOW_IF_OPS = ['eq', 'ne', 'truthy', 'falsy', 'in', 'contains'] as const;

export type ShowIfOp = (typeof SHOW_IF_OPS)[number];

/**
 * Value equality for the scalars a field can hold, plus arrays of them.
 *
 * Not `===`: a multiselect value is an array, and two arrays carrying the same members are
 * different objects, so identity would report "changed" on every render and hide a field
 * that should be showing.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  }
  return a === b;
}

function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

/**
 * Whether `def` applies, given the entry's current values.
 *
 * `true` for a field with no rule, and `true` for a rule this build cannot read. Both
 * defaults point the same way on purpose: this decides whether a control is on screen, and
 * an unreadable rule that hid the field would drop the registrant's answer silently rather
 * than showing them something they can act on.
 */
export function evaluateShowIf(
  def: { showIf?: ShowIfRule | null },
  values: Record<string, unknown>,
): boolean {
  const rule = def.showIf;
  if (!rule) return true;

  const actual = values[rule.field];

  switch (rule.op) {
    case 'eq':
      return sameValue(actual, rule.value);
    case 'ne':
      return !sameValue(actual, rule.value);
    case 'truthy':
      return truthy(actual);
    case 'falsy':
      return !truthy(actual);
    case 'in':
      return Array.isArray(rule.value) && rule.value.some((option) => sameValue(actual, option));
    case 'contains':
      return Array.isArray(actual) && actual.some((item) => sameValue(item, rule.value));
    default:
      return true;
  }
}
