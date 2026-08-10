import type { PublicField } from './types';

export interface FieldValueProps {
  field: PublicField;
  /**
   * Turns an attachment id into a URL, or `null` when there is none.
   *
   * Nullable rather than `string` because "this id has no URL" is routine — the deployment
   * has no object store, the upload never completed, the id points at someone else's
   * attachment — and a resolver forced to return a string would have to invent a broken
   * one. `RegistryProfile` always passes a resolver; a bare `FieldValue` need not.
   */
  resolveImageUrl?: (attachmentId: string) => string | null;
}

const DELIVERY_LABEL: Record<string, string> = {
  in_person: 'In person',
  virtual: 'Virtual',
  hybrid: 'In person or virtual',
};

export function FieldValue({ field, resolveImageUrl }: FieldValueProps) {
  const { type, value } = field;

  switch (type) {
    case 'url': {
      const href = String(value ?? '');
      if (!href) return null;
      return (
        <a className="rp-field__link" href={href} rel="noopener noreferrer nofollow" target="_blank">
          {href.replace(/^https?:\/\//, '')}
        </a>
      );
    }

    case 'email':
    case 'phone':
      // The server never serializes these, so reaching here means an embedder built the
      // data itself. Render the text, never a mailto:/tel: link — an address that is a
      // link is an address that is harvested.
      return <span className="rp-field__text">{String(value ?? '')}</span>;

    case 'boolean':
      return <span className="rp-field__text">{value ? 'Yes' : 'No'}</span>;

    case 'multi_select': {
      const items = Array.isArray(value) ? value.map(String) : [];
      if (items.length === 0) return null;
      return (
        <ul className="rp-field__tags">
          {items.map((item) => (
            <li className="rp-field__tag" key={item}>{item}</li>
          ))}
        </ul>
      );
    }

    case 'image': {
      const id = String(value ?? '');
      const src = id ? (resolveImageUrl?.(id) ?? null) : null;
      // No broken-image placeholder: an unresolvable id renders nothing at all, because a
      // profile with a torn picture icon looks worse than a profile without a picture.
      if (!src) return null;
      return <img className="rp-field__image" src={src} alt={field.label} />;
    }

    case 'address': {
      const a = (typeof value === 'object' && value !== null ? value : {}) as Record<string, string>;
      const parts = [a.line1, a.line2, a.city, a.region, a.postalCode, a.country].filter(Boolean);
      if (parts.length === 0) return null;
      return <span className="rp-field__text">{parts.join(', ')}</span>;
    }

    case 'markdown':
    case 'textarea':
      // Pre-wrapped text, NOT HTML: this component takes data from a registry it does not
      // control and runs on sites it does not own, so there is no safe place here to
      // trust a markdown-to-HTML conversion.
      return <p className="rp-field__prose">{String(value ?? '')}</p>;

    case 'date':
    case 'select':
    case 'text':
    default: {
      const text = String(value ?? '');
      if (!text) return null;
      return <span className="rp-field__text">{DELIVERY_LABEL[text] ?? text}</span>;
    }
  }
}
