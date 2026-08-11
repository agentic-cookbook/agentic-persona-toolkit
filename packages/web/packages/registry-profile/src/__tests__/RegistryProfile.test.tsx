import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RegistryProfile } from '../RegistryProfile';
import type { PublicEntry } from '../types';

const entry: PublicEntry = {
  slug: 'fishlamp',
  displayName: 'Fish Lamp Design',
  summary: 'iOS apps under contract',
  photoAttachmentId: null,
  providerType: 'organization',
  category: 'software.consulting',
  keywords: ['ios', 'swift'],
  locationText: 'Seattle, WA',
  countryCode: 'US',
  regionCode: 'WA',
  geo: null,
  areaServed: { text: 'North America' },
  deliveryMode: 'hybrid',
  links: [{ label: 'Site', url: 'https://fishlamp.example' }],
  contactMode: 'dm',
  languages: ['en'],
  fields: [
    { key: 'bio', label: 'Bio', type: 'text', value: 'twenty years of Cocoa', visibility: 'public' },
    { key: 'site', label: 'Portfolio', type: 'url', value: 'https://work.example', visibility: 'public' },
    { key: 'remote', label: 'Remote', type: 'boolean', value: true, visibility: 'public' },
    { key: 'stacks', label: 'Stacks', type: 'multi_select', value: ['Swift', 'Obj-C'], visibility: 'public' },
    // A registry owner may publish an email or a phone — `defaultVisibilityForType` starts
    // those types `private`, so doing it is a decision rather than an inheritance, and once
    // made the server serializes them like any other field. What this component must never
    // do is turn one into a `mailto:`/`tel:` affordance (see FieldValue's comment): it
    // renders the value as plain text. These two entries are what let "renders no email or
    // telephone affordance" actually exercise that arm of FieldValue, instead of vacuously
    // passing because the fixture never reaches it.
    { key: 'email', label: 'Email', type: 'email', value: 'hello@fishlamp.example', visibility: 'public' },
    { key: 'phone', label: 'Phone', type: 'phone', value: '+1 206 555 0100', visibility: 'public' },
  ],
  services: [],
  imageUrls: {},
};

describe('RegistryProfile', () => {
  it('renders the spine and every field it was given', () => {
    render(<RegistryProfile entry={entry} />);
    expect(screen.getByRole('heading', { name: 'Fish Lamp Design' })).toBeInTheDocument();
    expect(screen.getByText('iOS apps under contract')).toBeInTheDocument();
    expect(screen.getByText('twenty years of Cocoa')).toBeInTheDocument();
    expect(screen.getByText('Swift')).toBeInTheDocument();
  });

  it('renders every field it is given and hides none', () => {
    // The invariant: the SERVER strips, this component never hides. Rendering everything
    // and hiding some of it in CSS is the natural mistake in a data-driven profile, and
    // it is how private data leaks — the markup is in the page whatever the stylesheet says.
    const { container } = render(<RegistryProfile entry={entry} />);
    const rendered = container.querySelectorAll('[data-field-key]');
    expect(rendered).toHaveLength(entry.fields.length);
    for (const el of rendered) {
      expect(el.getAttribute('hidden')).toBeNull();
      expect(el.className).not.toMatch(/hidden|sr-only|visually-hidden/);
    }
  });

  it('marks a field narrowed to signed-in members, and marks nothing else', () => {
    // The marking is the ONLY evidence on the page that this reader is seeing more than a
    // stranger would. Without it a registrant reviewing their own live profile while signed
    // in reads the wider page as the public one — and publishes on that belief.
    const { container } = render(
      <RegistryProfile
        entry={{
          ...entry,
          fields: [
            ...entry.fields,
            { key: 'direct', label: 'Direct line', type: 'phone', value: '+1 206 555 0199', visibility: 'authenticated' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Signed-in members only')).toBeInTheDocument();
    expect(container.querySelectorAll('.rp__field-audience')).toHaveLength(1);
  });

  it('renders a url field as a link and a boolean as a word, not raw JSON', () => {
    render(<RegistryProfile entry={entry} />);
    expect(screen.getByRole('link', { name: /work\.example/ })).toHaveAttribute(
      'href',
      'https://work.example',
    );
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('renders the contact slot only when contactMode is dm', () => {
    const contact = <button type="button">Message them</button>;
    const { unmount } = render(<RegistryProfile entry={entry} contact={contact} />);
    expect(screen.getByRole('button', { name: 'Message them' })).toBeInTheDocument();
    unmount();

    render(<RegistryProfile entry={{ ...entry, contactMode: 'none' }} contact={contact} />);
    expect(screen.queryByRole('button', { name: 'Message them' })).not.toBeInTheDocument();
  });

  it('renders no email or telephone affordance at all', () => {
    const { container } = render(<RegistryProfile entry={entry} />);
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('omits the services block when there are none', () => {
    render(<RegistryProfile entry={entry} />);
    expect(screen.queryByRole('heading', { name: /services/i })).not.toBeInTheDocument();
  });

  it('renders the photo and an image field from entry.imageUrls, with no resolver prop', () => {
    // The default path, and the one both site pages use. An attachment id is unusable on
    // its own — every storage route is behind jwtAuth and a profile visitor is anonymous —
    // so the serving backend resolves the ids and the component just reads the map.
    render(
      <RegistryProfile
        entry={{
          ...entry,
          photoAttachmentId: 'att_photo',
          fields: [
            ...entry.fields,
            { key: 'shot', label: 'Screenshot', type: 'image', value: 'att_shot', visibility: 'public' },
          ],
          imageUrls: { att_photo: 'https://cdn.example/p.png', att_shot: 'https://cdn.example/s.png' },
        }}
      />,
    );
    expect(screen.getByAltText('Screenshot')).toHaveAttribute('src', 'https://cdn.example/s.png');
    // The header photo is decorative — the name is right beside it — so it carries an
    // empty alt and is found by src rather than by role.
    expect(document.querySelector('img.rp__photo')).toHaveAttribute(
      'src',
      'https://cdn.example/p.png',
    );
  });

  it('renders no image at all for an id the map does not cover', () => {
    // Routine, not exceptional: no object store configured, an upload that never
    // completed, or an id the server refused to presign because it belongs to someone
    // else. A torn-image icon would be worse than nothing.
    const { container } = render(
      <RegistryProfile entry={{ ...entry, photoAttachmentId: 'att_missing', imageUrls: {} }} />,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('lets a host override resolution entirely', () => {
    // The embedder case: their own CDN, their own signing. `imageUrls` is ignored.
    render(
      <RegistryProfile
        entry={{ ...entry, photoAttachmentId: 'att_photo', imageUrls: { att_photo: 'https://cdn.example/p.png' } }}
        resolveImageUrl={(id) => `https://mine.example/${id}`}
      />,
    );
    expect(document.querySelector('img.rp__photo')).toHaveAttribute(
      'src',
      'https://mine.example/att_photo',
    );
  });

  it('renders a service with its price', () => {
    render(
      <RegistryProfile
        entry={{
          ...entry,
          services: [{
            title: 'Contract iOS work', description: 'Swift, from spec to App Store',
            pricingModel: 'hourly', priceMin: 200, priceMax: null, currency: 'USD',
            unit: 'hour', deliveryMode: 'virtual',
          }],
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Services' })).toBeInTheDocument();
    expect(screen.getByText(/\$200 per hour/)).toBeInTheDocument();
  });
});
