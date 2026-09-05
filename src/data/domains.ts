export type DomainRoute =
  | "summary"
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
  { id: "summary", label: "Summary", shortLabel: "Summary", status: "published", description: "Performance relative to specialized models across modalities." },
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
    status: "pilot",
    description: "Recognize structures, landmarks, and anatomy in view.",
  },
  {
    id: "skill-assessment",
    label: "Skill assessment",
    shortLabel: "Skill assessment",
    status: "pilot",
    description: "Assess technique and performance against expert criteria.",
  },
  {
    id: "clinical-context",
    label: "Clinical context / VQA",
    shortLabel: "Context / VQA",
    status: "pilot",
    description: "Answer clinically grounded questions about the operative scene.",
  },
  {
    id: "recommendations",
    label: "Recommendations",
    shortLabel: "Recommendations",
    status: "pilot",
    description: "Recognize the current surgical action in the operative scene.",
  },
];

export const ROUTES: DomainRoute[] = DOMAINS.map((domain) => domain.id);
