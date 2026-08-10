import { Leaderboard } from "./components/Leaderboard";
import { boothLogo, sdscLogo } from "./assets/logos";
import { DATASET_CITATIONS, MODEL_CITATIONS, PAPER } from "./data/benchmark";

export default function App() {
  return (
    <div className="page">
      <header className="masthead">
        <div className="lockup">
          <a
            href="https://www.surgicalvideo.io"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Surgical Data Science Collective"
          >
            <img
              className="lockup__sdsc"
              src={sdscLogo}
              alt="Surgical Data Science Collective"
            />
          </a>
          <span className="lockup__rule" aria-hidden="true" />
          <a
            href="https://www.chicagobooth.edu"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="The University of Chicago Booth School of Business"
          >
            <img
              className="lockup__booth"
              src={boothLogo}
              alt="The University of Chicago Booth School of Business"
            />
          </a>
        </div>

        <h1>Surgical intelligence leaderboard</h1>
      </header>

      <main>
        <Leaderboard />
      </main>

      <footer className="footer">
        <ol className="footnotes">
          <li>
            <sup className="footnote-ref">1</sup> {PAPER.authorsShort}{" "}
            <cite>{PAPER.title}</cite>{" "}
            <a href={PAPER.url} target="_blank" rel="noreferrer">
              {PAPER.arxivId}
            </a>{" "}
            ({PAPER.year}).
          </li>
          {DATASET_CITATIONS.map((ref, index) => (
            <li key={ref.datasetName}>
              <sup className="footnote-ref">{index + 2}</sup> {ref.authorsShort}{" "}
              <cite>{ref.title}</cite>. {ref.venue}{" "}
              <a href={ref.url} target="_blank" rel="noreferrer">
                {ref.linkLabel}
              </a>{" "}
              ({ref.year}).
            </li>
          ))}
          {MODEL_CITATIONS.map((ref, index) => (
            <li key={ref.modelId}>
              <sup className="footnote-ref">{index + 2 + DATASET_CITATIONS.length}</sup>{" "}
              {ref.authorsShort} <cite>{ref.title}</cite>. {ref.venue}{" "}
              <a href={ref.url} target="_blank" rel="noreferrer">
                {ref.linkLabel}
              </a>{" "}
              ({ref.year}).
            </li>
          ))}
        </ol>
      </footer>
    </div>
  );
}
