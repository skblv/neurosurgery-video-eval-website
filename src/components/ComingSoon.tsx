import { DOMAINS, type DomainRoute } from "../data/domains";

export function ComingSoon({ route }: { route: DomainRoute }) {
  const domain = DOMAINS.find((item) => item.id === route);
  if (!domain) return null;

  return (
    <section className="coming-soon">
      <span className="status status--planned">Planned</span>
      <h2>{domain.label}</h2>
      <p>{domain.description}</p>
      <p>
        The benchmark protocol and clinical ground truth are being defined. Results will appear
        here when they can be compared reproducibly.
      </p>
    </section>
  );
}
