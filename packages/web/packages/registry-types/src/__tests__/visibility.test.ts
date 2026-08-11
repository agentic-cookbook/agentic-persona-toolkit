import { describe, expect, it } from 'vitest';
import { FIELD_TYPES } from '../types';
import {
  CONTACT_FIELD_TYPES,
  FIELD_VISIBILITIES,
  defaultVisibilityForType,
  isFieldVisibility,
  isWithinVisibility,
  tightestVisibility,
  visibilitiesWithin,
  visibilityAdmits,
} from '../visibility';

describe('FIELD_VISIBILITIES', () => {
  it('is ordered loosest to tightest', () => {
    // Every function in this module compares positions on this tuple, so the ORDER is
    // load-bearing in a way the member set alone is not: reversing it silently inverts
    // both the read rule and the write rule while every type still checks.
    expect([...FIELD_VISIBILITIES]).toEqual(['public', 'authenticated', 'private']);
  });

  it('recognizes its own members and nothing else', () => {
    for (const v of FIELD_VISIBILITIES) expect(isFieldVisibility(v)).toBe(true);
    expect(isFieldVisibility('unlisted')).toBe(false);
    expect(isFieldVisibility('')).toBe(false);
    expect(isFieldVisibility(undefined)).toBe(false);
  });
});

describe('visibilityAdmits', () => {
  it('shows an anonymous viewer public fields only', () => {
    expect(visibilityAdmits('public', 'public')).toBe(true);
    expect(visibilityAdmits('authenticated', 'public')).toBe(false);
    expect(visibilityAdmits('private', 'public')).toBe(false);
  });

  it('shows a signed-in viewer public and authenticated fields, never private', () => {
    expect(visibilityAdmits('public', 'authenticated')).toBe(true);
    expect(visibilityAdmits('authenticated', 'authenticated')).toBe(true);
    // `private` means no public-plane request sees it, however the caller signed in. The
    // people entitled to it read it through the authenticated entry API instead.
    expect(visibilityAdmits('private', 'authenticated')).toBe(false);
  });
});

describe('tightestVisibility', () => {
  it('takes the tighter of the two, in either argument order', () => {
    expect(tightestVisibility('public', 'authenticated')).toBe('authenticated');
    expect(tightestVisibility('authenticated', 'public')).toBe('authenticated');
    expect(tightestVisibility('private', 'public')).toBe('private');
    expect(tightestVisibility('public', 'public')).toBe('public');
  });
});

describe('isWithinVisibility', () => {
  it('lets a registrant tighten and refuses every loosening', () => {
    expect(isWithinVisibility('private', 'public')).toBe(true);
    expect(isWithinVisibility('authenticated', 'public')).toBe(true);
    expect(isWithinVisibility('public', 'public')).toBe(true);

    expect(isWithinVisibility('public', 'authenticated')).toBe(false);
    expect(isWithinVisibility('public', 'private')).toBe(false);
    expect(isWithinVisibility('authenticated', 'private')).toBe(false);
  });

  it('agrees with visibilitiesWithin on every pair', () => {
    // The picker's option list and the server's refusal are the same rule; a mismatch
    // would offer a registrant a choice their save then rejects.
    for (const ceiling of FIELD_VISIBILITIES) {
      const offered = visibilitiesWithin(ceiling);
      for (const candidate of FIELD_VISIBILITIES) {
        expect(offered.includes(candidate)).toBe(isWithinVisibility(candidate, ceiling));
      }
      expect(offered).toContain(ceiling);
    }
  });
});

describe('defaultVisibilityForType', () => {
  it('starts contact types private and everything else public', () => {
    for (const type of FIELD_TYPES) {
      expect(defaultVisibilityForType(type)).toBe(
        CONTACT_FIELD_TYPES.has(type) ? 'private' : 'public',
      );
    }
    expect(defaultVisibilityForType('email')).toBe('private');
    expect(defaultVisibilityForType('phone')).toBe('private');
    expect(defaultVisibilityForType('address')).toBe('private');
    expect(defaultVisibilityForType('text')).toBe('public');
  });

  it('fails closed on a type it does not recognize', () => {
    expect(defaultVisibilityForType('ssn')).toBe('private');
    expect(defaultVisibilityForType('')).toBe('private');
  });
});
