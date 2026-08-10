import type { PublicService } from './types';

const PRICING_SUFFIX: Record<string, string> = {
  hourly: 'per hour',
  per_job: 'per job',
  per_deliverable: 'per deliverable',
  subscription: 'per month',
};

function priceText(service: PublicService): string {
  if (service.pricingModel === 'free') return 'Free';
  if (service.pricingModel === 'barter') return 'Trade or barter';
  const { priceMin, priceMax, currency } = service;
  if (priceMin == null && priceMax == null) return 'Rate on request';
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  const range =
    priceMin != null && priceMax != null && priceMin !== priceMax
      ? `${fmt(priceMin)}–${fmt(priceMax)}`
      : fmt((priceMin ?? priceMax) as number);
  return `${range} ${PRICING_SUFFIX[service.pricingModel] ?? ''}`.trim();
}

export function ServiceList({ services }: { services: PublicService[] }) {
  if (services.length === 0) return null;
  return (
    <section className="rp-services">
      <h2 className="rp-services__heading">Services</h2>
      <ul className="rp-services__list">
        {services.map((service) => (
          <li className="rp-service" key={service.title}>
            <h3 className="rp-service__title">{service.title}</h3>
            {service.description ? (
              <p className="rp-service__description">{service.description}</p>
            ) : null}
            <p className="rp-service__price">{priceText(service)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
