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

// JSON values from a jsonb column cannot contain a real reference cycle — `JSON.parse`
// never aliases, so a value can never contain itself. What IS reachable is a
// pathologically deep or malformed blob, and unbounded recursion on that is a real hang,
// not a theoretical one. A depth cap is the simple, sufficient guard for that shape of
// input; no legitimate field value (an address is six flat string keys) comes close to it.
const MAX_COMPARE_DEPTH = 32;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Value equality for the scalars a field can hold, arrays of them, and plain objects
 * (`address`'s stored shape, and any future compound type's).
 *
 * Not `===`: a multiselect value is an array, and an address value is an object — two
 * structurally identical instances of either are different references, so identity would
 * report "changed" on every render and hide a field that should be showing.
 *
 * Objects are deep-compared, not left to the `===` fallback, because an `eq`/`ne` rule
 * against an object-shaped value used to be exactly the "rule this build cannot read" case
 * `evaluateShowIf` documents itself as failing OPEN on (see its docblock, and the `in` op
 * below) — except reference equality made it fail CLOSED instead: two freshly-fetched,
 * field-for-field identical `address` values compared unequal, so the rule silently hid
 * the field forever, exactly the outcome those fail-open branches exist to prevent. Deep
 * comparison removes the uninterpretable case rather than adding a third fail-open branch
 * for it — after this, `eq`/`ne` against an object means what it says.
 *
 * `key in b` is deliberately not used for the membership check inside the object branch:
 * these values can originate from an untrusted jsonb blob, and `in` walks the prototype
 * chain, so a hostile payload using a key like `"constructor"` would read as "present" on
 * an object that has no OWN property by that name. `Object.hasOwn` does not have that gap.
 */
function sameValue(a: unknown, b: unknown, depth = 0): boolean {
  if (depth > MAX_COMPARE_DEPTH) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameValue(item, b[i], depth + 1));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length
      && aKeys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key], depth + 1))
    );
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
      // A scalar `rule.value` here is a malformed rule, not a "no match" — the same case
      // the unknown-op default below exists to handle. Failing open (show the field) keeps
      // this consistent with that default instead of hiding the field permanently on an
      // authoring mistake this build cannot interpret.
      if (!Array.isArray(rule.value)) return true;
      return rule.value.some((option) => sameValue(actual, option));
    case 'contains':
      return Array.isArray(actual) && actual.some((item) => sameValue(item, rule.value));
    default:
      return true;
  }
}
