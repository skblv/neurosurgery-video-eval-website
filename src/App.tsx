import { useMemo, useState } from "react";

import { ResultsChart } from "./components/ResultsChart";
import { ResultsTable } from "./components/ResultsTable";
import { boothLogo, sdscLogo } from "./assets/logos";
import { DATASETS, PAPER, type DatasetId } from "./data/benchmark";

export default function App() {
  const [activeId, setActiveId] = useState<DatasetId>("cholect50");
  const active = useMemo(() => DATASETS.find((d) => d.id === activeId)!, [activeId]);

  return (
    <div className="page">
      <header className="masthead">
        <div className="lockup">
          <a href="https://www.surgicalvideo.io/about" target="_blank" rel="noreferrer">
            <img
              className="lockup__sdsc"
              src={sdscLogo}
              alt="Surgical Data Science Collective"
            />
          </a>
          <span className="lockup__rule" aria-hidden="true" />
          <a
            href="https://www.chicagobooth.edu/research/center-for-applied-ai"
            target="_blank"
            rel="noreferrer"
          >
            <img
              className="lockup__booth"
              src={boothLogo}
              alt="The University of Chicago Booth School of Business"
            />
          </a>
        </div>

        <h1>Surgical intelligence leaderboard</h1>
        <p className="masthead__lede">
          How well do today's vision–language models identify the instruments in a surgical video
          frame? Exact-match accuracy is the share of frames where the predicted set of instruments
          is exactly the ground-truth set. No partial credit; malformed output counts as incorrect.
        </p>
      </header>

      <main>
        <section className="section" aria-labelledby="results-heading">
          <h2 id="results-heading" className="visually-hidden">
            Results
          </h2>

          <div className="tabs" role="tablist" aria-label="Dataset">
            {DATASETS.map((dataset) => (
              <button
                key={dataset.id}
                role="tab"
                type="button"
                aria-selected={dataset.id === activeId}
                className={dataset.id === activeId ? "tab tab--active" : "tab"}
                onClick={() => setActiveId(dataset.id)}
              >
                <span className="tab__name">{dataset.name}</span>
                <span className="tab__meta">{dataset.procedure}</span>
              </button>
            ))}
          </div>

          <ResultsChart dataset={active} />
          <ResultsTable dataset={active} />
        </section>
      </main>

      <footer className="footer">
        <p className="citation">
          {PAPER.authorsShort} <cite>{PAPER.title}</cite>{" "}
          <a href={PAPER.url} target="_blank" rel="noreferrer">
            {PAPER.arxivId}
          </a>{" "}
          ({PAPER.year}).
        </p>
        <div className="footer__logos">
          <img src={sdscLogo} alt="Surgical Data Science Collective" />
          <img
            className="footer__booth"
            src={boothLogo}
            alt="The University of Chicago Booth School of Business"
          />
        </div>
      </footer>
    </div>
  );
}
