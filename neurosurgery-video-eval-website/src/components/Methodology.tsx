import { SUMMARY_MODALITIES } from "../data/summary";
import { routePath } from "../data/routes";

const metricLabels: Record<string, string> = { microF1: "Micro F1", exactMatch: "Exact match", exactAccuracy: "Exact frame accuracy" };

export function Methodology() {
  return <section className="methodology" aria-labelledby="methodology-heading">
    <h2 id="methodology-heading">Methodology</h2>
    <div className="methodology-content">
    <div className="methodology-explanation">
    <p>Dataset score = (model performance − chance performance) ÷ (specialised reference performance − chance performance). A score of 0 matches chance and 1 matches the specialist. Datasets contribute equally to their modality score. The total averages modality scores, so dataset-rich modalities do not dominate. When results are missing, weights are redistributed equally among available datasets and modalities.</p>
    <p>Chance is the exact expected score after randomly shuffling the observed label sets across frames, preserving label frequencies and the number of labels per frame across the sample. Each dataset uses one fixed chance baseline from its frozen seed-42 validation sample of up to 1,000 frames. Negative scores and scores above 1 are retained.</p>
    <p>Reference models are fixed per dataset, not selected by the highest score. The SDSC/UChicago row combines these specialists; it is not one model. LemonFM uses task-trained linear probes. Scores compare each model’s reported evaluation and may use different sample sizes, as documented on the modality pages. The single-operation Action pilot has no verified chance baseline yet, so its adjusted score is NA and it is excluded from the index; its original results remain on the Action page.</p>
    </div>
    <div className="methodology-references">
    {SUMMARY_MODALITIES.map((modality) => <div key={modality.id}>
      <h3><a href={routePath(modality.id)}>{modality.label}</a></h3>
      <p className="summary-muted">{modality.datasets.map((dataset) => `${dataset.name}: ${metricLabels[dataset.metric]}; specialist ${dataset.results.find((result) => result.id === dataset.referenceId)?.model ?? "NA"}; chance ${dataset.chance === null ? "NA" : `${dataset.chance.toFixed(2)}%`}`).join(" · ")}</p>
    </div>)}
    </div>
    </div>
  </section>;
}
