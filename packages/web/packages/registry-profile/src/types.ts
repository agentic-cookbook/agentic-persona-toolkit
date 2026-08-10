import type { FieldType } from '@agenticdevelopertoolkit/registry-types';

export interface PublicField {
  key: string;
  label: string;
  type: FieldType;
  value: unknown;
}

export interface PublicService {
  title: string;
  description: string;
  pricingModel: string;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  unit: string;
  deliveryMode: string;
}

/**
 * Exactly what the backend's public entry route returns.
 *
 * The server has already applied field visibility: a private field's key, label and value
 * are absent here, not merely flagged. Nothing in this package hides anything.
 */
export interface PublicEntry {
  slug: string;
  displayName: string;
  summary: string;
  photoAttachmentId: string | null;
  providerType: string;
  category: string;
  keywords: string[];
  locationText: string;
  countryCode: string;
  regionCode: string;
  geo: { lat: number; lon: number } | null;
  areaServed: Record<string, unknown>;
  deliveryMode: string;
  links: Array<{ label: string; url: string }>;
  /** 'dm' | 'none'. Never an address — the server does not serialize one. */
  contactMode: string;
  languages: string[];
  fields: PublicField[];
  services: PublicService[];
  /**
   * Attachment id → URL, for the photo and for every `image` field.
   *
   * An attachment id on its own is unusable: every route in the adh backend's
   * `routes/storage.ts` sits behind `jwtAuth`, and a profile page is read by visitors who
   * are not signed in. So the server that serialized this entry resolved the ids it was
   * willing to expose and put the URLs here. An id absent from the map has no image, and
   * that is a normal state, not an error.
   *
   * The URLs are short-lived presigned links. Render them; never persist or cache them.
   */
  imageUrls: Record<string, string>;
}
