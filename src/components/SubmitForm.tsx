import { useState, type ChangeEvent, type FormEvent } from "react";

import { DATASETS, type DatasetId } from "../data/benchmark";
import {
  API_PROVIDERS,
  EVAL_SCOPES,
  FAMILY_LABELS,
  MODEL_FAMILIES,
  NEW_FAMILY,
  PROVIDER_LABELS,
  SCOPE_LABELS,
  submitModel,
  type ApiProvider,
  type EvalScope,
  type ModelFamily,
  type SubmissionDraft,
} from "../api/submissions";

const ALL_DATASET_IDS = DATASETS.map((dataset) => dataset.id);

const EMPTY_DRAFT: SubmissionDraft = {
  accessCode: "",
  modelName: "",
  modelFamily: "openai",
  newFamilyName: "",
  apiProvider: "openai",
  modelApiId: "",
  evalScope: "sample_1000",
  datasets: ALL_DATASET_IDS,
  submitterEmail: "",
  logo: null,
};

/**
 * Form that queues a model for evaluation on the leaderboard's datasets.
 *
 * A model whose family has no icon yet is accepted but parked rather than run,
 * so the form asks for a logo in that case and says plainly what will happen.
 */
export function SubmitForm() {
  const [draft, setDraft] = useState<SubmissionDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isNewFamily = draft.modelFamily === NEW_FAMILY;

  const update = <K extends keyof SubmissionDraft>(
    key: K,
    value: SubmissionDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const toggleDataset = (id: DatasetId) =>
    setDraft((current) => {
      const selected = new Set(current.datasets);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return {
        ...current,
        datasets: ALL_DATASET_IDS.filter((item) => selected.has(item)),
      };
    });

  const onLogoChange = (event: ChangeEvent<HTMLInputElement>) =>
    update("logo", event.target.files?.[0] ?? null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (draft.datasets.length === 0) {
      setError("Pick at least one dataset to evaluate on.");
      return;
    }
    if (isNewFamily && !draft.logo) {
      setError(
        "This family has no icon on the leaderboard yet, so a logo is required.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const accepted = await submitModel(draft);
      window.location.hash = `#/status/${accepted.status_token}`;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={onSubmit}>
      <p className="form__lede">
        Submissions run on the same held-out frames and scoring code as every row
        on the leaderboard. You need an access code from the maintainers, and the
        model has to be reachable through one of the APIs below.
      </p>

      <label className="field">
        <span className="field__label">Access code</span>
        <input
          className="field__input"
          type="password"
          required
          autoComplete="off"
          value={draft.accessCode}
          onChange={(event) => update("accessCode", event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Model name</span>
        <input
          className="field__input"
          type="text"
          required
          maxLength={200}
          placeholder="Claude Sonnet 4.6"
          value={draft.modelName}
          onChange={(event) => update("modelName", event.target.value)}
        />
        <span className="field__hint">Shown on the leaderboard row.</span>
      </label>

      <label className="field">
        <span className="field__label">Model family</span>
        <select
          className="field__input"
          value={draft.modelFamily}
          onChange={(event) =>
            update("modelFamily", event.target.value as ModelFamily)
          }
        >
          {MODEL_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {FAMILY_LABELS[family]}
            </option>
          ))}
        </select>
        <span className="field__hint">Sets the icon beside the model name.</span>
      </label>

      {isNewFamily && (
        <>
          <label className="field">
            <span className="field__label">New family name</span>
            <input
              className="field__input"
              type="text"
              required
              maxLength={100}
              placeholder="Qwen"
              value={draft.newFamilyName}
              onChange={(event) => update("newFamilyName", event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Family logo</span>
            <input
              className="field__input"
              type="file"
              required
              accept=".svg,.png,.jpg,.jpeg,.webp"
              onChange={onLogoChange}
            />
            <span className="field__hint">
              SVG or PNG, under 2 MB. It becomes the row icon. Because this family
              is new, your submission is saved and run once a maintainer adds the
              icon; nothing further is needed from you.
            </span>
          </label>
        </>
      )}

      <label className="field">
        <span className="field__label">Call it through</span>
        <select
          className="field__input"
          value={draft.apiProvider}
          onChange={(event) =>
            update("apiProvider", event.target.value as ApiProvider)
          }
        >
          {API_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABELS[provider]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Model ID at that API</span>
        <input
          className="field__input"
          type="text"
          required
          maxLength={300}
          placeholder="claude-sonnet-4-6-20260514"
          value={draft.modelApiId}
          onChange={(event) => update("modelApiId", event.target.value)}
        />
      </label>

      <fieldset className="field">
        <legend className="field__label">Datasets</legend>
        <div className="checks">
          {DATASETS.map((dataset) => (
            <label className="check" key={dataset.id}>
              <input
                type="checkbox"
                checked={draft.datasets.includes(dataset.id)}
                onChange={() => toggleDataset(dataset.id)}
              />
              <span>{dataset.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span className="field__label">Evaluate on</span>
        <select
          className="field__input"
          value={draft.evalScope}
          onChange={(event) =>
            update("evalScope", event.target.value as EvalScope)
          }
        >
          {EVAL_SCOPES.map((scope) => (
            <option key={scope} value={scope}>
              {SCOPE_LABELS[scope]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Your email</span>
        <input
          className="field__input"
          type="email"
          required
          value={draft.submitterEmail}
          onChange={(event) => update("submitterEmail", event.target.value)}
        />
        <span className="field__hint">
          Recorded with the submission so a maintainer can reach you. Progress is
          shown on the page you land on next, not emailed.
        </span>
      </label>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <button className="button" type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit for evaluation"}
      </button>
    </form>
  );
}
