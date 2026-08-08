/**
 * Client for the evaluation service that runs submitted models.
 *
 * The service is a small FastAPI app behind CloudFront; it is not part of this
 * bundle and is not reachable without the access code the maintainers hand out.
 * Errors from it are surfaced verbatim to the submitter, because the messages it
 * returns are written for them rather than for a log.
 */

import type { DatasetId } from "../data/benchmark";

const API_BASE = (
  import.meta.env.VITE_EVAL_API_BASE ?? "https://d1blftd1yj2phk.cloudfront.net"
).replace(/\/$/, "");

export const MODEL_FAMILIES = [
  "openai",
  "anthropic",
  "gemini",
  "moonshot",
  "internal",
  "new_family",
] as const;

export const API_PROVIDERS = ["openai", "anthropic", "google", "openrouter"] as const;

export const EVAL_SCOPES = ["full", "sample_1000"] as const;

export type ModelFamily = (typeof MODEL_FAMILIES)[number];
export type ApiProvider = (typeof API_PROVIDERS)[number];
export type EvalScope = (typeof EVAL_SCOPES)[number];

export const NEW_FAMILY: ModelFamily = "new_family";

/** Labels for the family picker. Values are the service's wire values. */
export const FAMILY_LABELS: Record<ModelFamily, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google DeepMind",
  moonshot: "Moonshot AI",
  internal: "Surgical Data Science Collective × Chicago Booth",
  new_family: "A family not listed here",
};

export const PROVIDER_LABELS: Record<ApiProvider, string> = {
  openai: "OpenAI API",
  anthropic: "Anthropic API",
  google: "Google Gemini API",
  openrouter: "OpenRouter",
};

export const SCOPE_LABELS: Record<EvalScope, string> = {
  full: "Every held-out frame",
  sample_1000: "A 1,000-frame sample (faster, wider confidence intervals)",
};

export type SubmissionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "rejected";

export interface SubmissionDraft {
  accessCode: string;
  modelName: string;
  modelFamily: ModelFamily;
  newFamilyName: string;
  apiProvider: ApiProvider;
  modelApiId: string;
  evalScope: EvalScope;
  datasets: DatasetId[];
  submitterEmail: string;
  logo: File | null;
}

export interface SubmissionAccepted {
  submission_id: string;
  status_token: string;
  status: SubmissionStatus;
  detail: string;
  queued: boolean;
}

export interface DatasetScore {
  dataset: string;
  exactMatchPct: number;
  microF1Pct: number;
  framesScored: number;
}

export interface RunStatus {
  model_name: string;
  datasets: string[];
  eval_scope: string;
  status: SubmissionStatus;
  detail: string;
  progress_pct: number;
  metrics: DatasetScore[];
  submitted_at: string;
  updated_at: string;
}

interface FieldError {
  field: string;
  message: string;
}

/**
 * Turns a failed response into a message worth showing a submitter.
 *
 * The service answers with either a plain `detail` string or, for validation
 * failures, a list of field and message pairs.
 */
async function errorMessage(response: Response): Promise<string> {
  const fallback = `The evaluation service answered ${response.status}.`;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return fallback;
  }

  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const parts = (detail as FieldError[])
      .filter((item) => typeof item?.message === "string")
      .map((item) => `${item.field}: ${item.message}`);
    if (parts.length > 0) return parts.join("; ");
  }

  return fallback;
}

/**
 * Submits a model for evaluation.
 *
 * @param draft - The completed form.
 * @returns The recorded submission, including the token that watches its run.
 * @throws Error carrying the service's own explanation if it refuses the
 *   submission, or a connection message if it cannot be reached at all.
 */
export async function submitModel(
  draft: SubmissionDraft,
): Promise<SubmissionAccepted> {
  const body = new FormData();
  body.set("access_code", draft.accessCode.trim());
  body.set("model_name", draft.modelName.trim());
  body.set("model_family", draft.modelFamily);
  body.set("api_provider", draft.apiProvider);
  body.set("model_api_id", draft.modelApiId.trim());
  body.set("eval_scope", draft.evalScope);
  body.set("submitter_email", draft.submitterEmail.trim());
  for (const dataset of draft.datasets) body.append("datasets", dataset);
  if (draft.modelFamily === NEW_FAMILY) {
    body.set("new_family_name", draft.newFamilyName.trim());
  }
  if (draft.logo) body.set("logo", draft.logo);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/public/submissions`, {
      method: "POST",
      body,
    });
  } catch (cause) {
    throw new Error(
      `Could not reach the evaluation service at ${API_BASE}. ` +
        `It may be down; try again shortly.`,
      { cause },
    );
  }

  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as SubmissionAccepted;
}

/**
 * Reads the progress of a submission.
 *
 * @param statusToken - The token handed back when the model was submitted.
 * @returns The submission's current state.
 * @throws Error if the token is unknown or the service cannot be reached.
 */
export async function fetchRunStatus(statusToken: string): Promise<RunStatus> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/public/runs/${encodeURIComponent(statusToken)}`,
    );
  } catch (cause) {
    throw new Error(
      `Could not reach the evaluation service at ${API_BASE}.`,
      { cause },
    );
  }

  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as RunStatus;
}
