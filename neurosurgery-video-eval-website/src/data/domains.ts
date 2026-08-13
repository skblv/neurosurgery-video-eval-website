export type DomainRoute =
  | "instruments"
  | "gestures"
  | "anatomy"
  | "clinical-context"
  | "recommendations"
  | "skill-assessment";

export interface DomainDefinition {
  id: DomainRoute;
  label: string;
  shortLabel: string;
  status: "published" | "pilot" | "planned";
  description: string;
}

export const DOMAINS: DomainDefinition[] = [
  {
    id: "instruments",
    label: "Instruments",
    shortLabel: "Instrument",
    status: "published",
    description: "Identify the tools visible in individual surgical frames.",
  },
  {
    id: "gestures",
    label: "Action",
    shortLabel: "Action",
    status: "pilot",
    description: "Follow what instruments are doing across time.",
  },
  {
    id: "anatomy",
    label: "Anatomy",
    shortLabel: "Anatomy",
    status: "planned",
    description: "Recognize structures, landmarks, and anatomy in view.",
  },
  {
    id: "skill-assessment",
    label: "Skill assessment",
    shortLabel: "Skill assessment",
    status: "planned",
    description: "Assess technique and performance against expert criteria.",
  },
  {
    id: "clinical-context",
    label: "Clinical context / VQA",
    shortLabel: "Context / VQA",
    status: "planned",
    description: "Answer clinically grounded questions about the operative scene.",
  },
  {
    id: "recommendations",
    label: "Recommendations",
    shortLabel: "Recommendations",
    status: "planned",
    description: "Evaluate safe, evidence-grounded decision support.",
  },
];

export const ROUTES: DomainRoute[] = DOMAINS.map((domain) => domain.id);
