import { DOMAINS, type DomainRoute } from "../data/domains";

export function DomainNav({ active }: { active: DomainRoute }) {
  return (
    <nav className="domain-nav" aria-label="Surgical intelligence domains">
      <div className="domain-nav__track">
        {DOMAINS.map((item) => (
          <a
            key={item.id}
            href={`#/${item.id}`}
            className={item.id === active ? "domain-nav__link domain-nav__link--active" : "domain-nav__link"}
            aria-current={item.id === active ? "page" : undefined}
          >
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
