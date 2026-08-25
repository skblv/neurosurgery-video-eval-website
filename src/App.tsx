import { useEffect, useState } from "react";

import { boothLogo, sdscLogo } from "./assets/logos";
import { AboutUs } from "./components/AboutUs";
import { ComingSoon } from "./components/ComingSoon";
import { DomainNav } from "./components/DomainNav";
import { GestureLeaderboard } from "./components/GestureLeaderboard";
import { InstrumentLeaderboard } from "./components/Leaderboard";
import {
  DATASET_CITATIONS,
  GESTURE_MODEL_CITATIONS,
  MODEL_CITATIONS,
  PAPER,
  gestureModelFootnote,
} from "./data/benchmark";
import { ROUTES, type DomainRoute } from "./data/domains";

function routeFromHash(): DomainRoute {
  const candidate = window.location.hash.replace(/^#\/?/, "") || "instruments";
  return ROUTES.includes(candidate as DomainRoute)
    ? (candidate as DomainRoute)
    : "instruments";
}

function PageContent({ route }: { route: DomainRoute }) {
  switch (route) {
    case "instruments":
      return <InstrumentLeaderboard />;
    case "gestures":
      return <GestureLeaderboard />;
    case "anatomy":
    case "clinical-context":
    case "recommendations":
    case "skill-assessment":
      return <ComingSoon route={route} />;
    default: {
      const exhaustive: never = route;
      throw new Error(`Unhandled domain route: ${exhaustive}`);
    }
  }
}

function InstrumentSources() {
  return (
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
          <sup className="footnote-ref">
            {index + 2 + DATASET_CITATIONS.length}
          </sup>{" "}
          {ref.authorsShort} <cite>{ref.title}</cite>. {ref.venue}{" "}
          <a href={ref.url} target="_blank" rel="noreferrer">
            {ref.linkLabel}
          </a>{" "}
          ({ref.year}).
        </li>
      ))}
    </ol>
  );
}

function GestureSources() {
  return (
    <ol className="footnotes">
      {GESTURE_MODEL_CITATIONS.map((ref) => (
        <li key={ref.modelId}>
          <sup className="footnote-ref">
            {gestureModelFootnote(ref.modelId)}
          </sup>{" "}
          {ref.authorsShort} <cite>{ref.title}</cite>. {ref.venue}{" "}
          <a href={ref.url} target="_blank" rel="noreferrer">
            {ref.linkLabel}
          </a>{" "}
          ({ref.year}).
        </li>
      ))}
    </ol>
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
    document.title = "SDSC x UChicago Surgical Intelligence Leaderboard";
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
        <h1>Surgical Intelligence Leaderboard</h1>
      </header>

      <DomainNav active={route} />

      <main id="main-content">
        <PageContent route={route} />
      </main>

      <footer className="footer">
        {route === "instruments" ? <InstrumentSources /> : null}
        {route === "gestures" ? <GestureSources /> : null}
      </footer>

      <AboutUs />
    </div>
  );
}
