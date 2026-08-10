/** The v1 field-type catalog. Field TYPES are code; field INSTANCES are data. */
export const FIELD_TYPES = [
  'text',
  'textarea',
  'markdown',
  'select',
  'multi_select',
  'url',
  'email',
  'phone',
  'boolean',
  'date',
  'image',
  'address',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** The shape both the builder and the entry editor need from a field definition. */
export interface FieldDefLike {
  key: string;
  type: FieldType;
  required: boolean;
  config: Record<string, unknown>;
}

/** The storage shape of an `address` value. */
export interface AddressValue {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export function isFieldType(value: unknown): value is FieldType {
  return typeof value === 'string' && (FIELD_TYPES as readonly string[]).includes(value);
}
