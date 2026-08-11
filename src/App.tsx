import { useEffect, useState } from "react";

import { boothLogo, sdscLogo } from "./assets/logos";
import { ComingSoon } from "./components/ComingSoon";
import { DomainNav } from "./components/DomainNav";
import { GestureLeaderboard } from "./components/GestureLeaderboard";
import { InstrumentLeaderboard } from "./components/Leaderboard";
import { DATASET_CITATIONS, MODEL_CITATIONS, PAPER } from "./data/benchmark";
import { DOMAINS, ROUTES, type DomainRoute } from "./data/domains";
import { GESTURE_SOURCES } from "./data/gestureBenchmark";

function routeFromHash(): DomainRoute {
  const candidate = window.location.hash.replace(/^#\/?/, "") || "instruments";
  return ROUTES.includes(candidate as DomainRoute) ? (candidate as DomainRoute) : "instruments";
}

function PageContent({ route }: { route: DomainRoute }) {
  if (route === "instruments") return <InstrumentLeaderboard />;
  if (route === "gestures") return <GestureLeaderboard />;
  return <ComingSoon route={route} />;
}

function InstrumentSources() {
  return (
    <ol className="footnotes">
      <li>
        <sup className="footnote-ref">1</sup> {PAPER.authorsShort}{" "}
        <cite>{PAPER.title}</cite>{" "}
        <a href={PAPER.url} target="_blank" rel="noreferrer">{PAPER.arxivId}</a>{" "}
        ({PAPER.year}).
      </li>
      {DATASET_CITATIONS.map((ref, index) => (
        <li key={ref.datasetName}>
          <sup className="footnote-ref">{index + 2}</sup> {ref.authorsShort}{" "}
          <cite>{ref.title}</cite>. {ref.venue}{" "}
          <a href={ref.url} target="_blank" rel="noreferrer">{ref.linkLabel}</a>{" "}
          ({ref.year}).
        </li>
      ))}
      {MODEL_CITATIONS.map((ref, index) => (
        <li key={ref.modelId}>
          <sup className="footnote-ref">{index + 2 + DATASET_CITATIONS.length}</sup>{" "}
          {ref.authorsShort} <cite>{ref.title}</cite>. {ref.venue}{" "}
          <a href={ref.url} target="_blank" rel="noreferrer">{ref.linkLabel}</a>{" "}
          ({ref.year}).
        </li>
      ))}
    </ol>
  );
}

function GestureSources() {
  return (
    <div className="gesture-sources">
      <p className="eyebrow">Model sources</p>
      <ul>
        {GESTURE_SOURCES.map((source) => (
          <li key={source.label}>
            <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<DomainRoute>(routeFromHash);

  useEffect(() => {
    const handleHashChange = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const label = DOMAINS.find((domain) => domain.id === route)?.label ?? "Instruments";
    document.title = `${label} — Surgical Intelligence Leaderboard`;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [route]);

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
            <img className="lockup__sdsc" src={sdscLogo} alt="Surgical Data Science Collective" />
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

      <DomainNav active={route} />

      <main id="main-content">
        <PageContent route={route} />
      </main>

      <footer className="footer">
        {route === "instruments" ? <InstrumentSources /> : null}
        {route === "gestures" ? <GestureSources /> : null}
        <p className="footer__mark">Surgical Data Science Collective × Chicago Booth</p>
      </footer>
    </div>
  );
}
