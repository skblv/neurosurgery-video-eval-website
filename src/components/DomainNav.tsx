import { DOMAINS, type DomainRoute } from "../data/domains";

export function DomainNav({ active }: { active: DomainRoute }) {
  const items = [
    { id: "overview" as const, label: "Overview", status: "published" as const },
    ...DOMAINS.map(({ id, label, status }) => ({ id, label, status })),
  ];

  return (
    <nav className="domain-nav" aria-label="Surgical intelligence domains">
      <div className="domain-nav__track">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#/${item.id}`}
            className={item.id === active ? "domain-nav__link domain-nav__link--active" : "domain-nav__link"}
            aria-current={item.id === active ? "page" : undefined}
          >
            <span>{item.label}</span>
            {item.status === "pilot" ? <span className="domain-nav__dot" aria-label="pilot" /> : null}
          </a>
        ))}
      </div>
    </nav>
  );
}
