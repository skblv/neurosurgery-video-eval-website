import { Leaderboard } from "./components/Leaderboard";
import { StatusPage } from "./components/StatusPage";
import { SubmitForm } from "./components/SubmitForm";
import { useHashRoute } from "./hooks/useHashRoute";
import { boothLogo, sdscLogo } from "./assets/logos";
import { SUBMIT_ROUTE } from "./config";
import { PAPER } from "./data/benchmark";

const STATUS_PREFIX = "status/";

/**
 * Picks the page for a hash route.
 *
 * @param route - Hash with its leading `#/` stripped.
 * @returns The page content, or a not-found notice for anything unrecognised.
 */
function routeContent(route: string) {
  if (route === "") return <Leaderboard />;

  if (route === SUBMIT_ROUTE) {
    return (
      <section className="section" aria-labelledby="submit-heading">
        <h2 id="submit-heading" className="heading">
          Submit a model
        </h2>
        <SubmitForm />
      </section>
    );
  }

  if (route.startsWith(STATUS_PREFIX)) {
    const token = route.slice(STATUS_PREFIX.length);
    return (
      <section className="section" aria-labelledby="status-heading">
        <h2 id="status-heading" className="heading">
          Submission status
        </h2>
        <StatusPage statusToken={token} />
      </section>
    );
  }

  return (
    <section className="section">
      <h2 className="heading">Nothing here</h2>
      <p>
        That link does not match a page on this site. <a href="#/">Back to the leaderboard</a>.
      </p>
    </section>
  );
}

export default function App() {
  const route = useHashRoute();
  const onLeaderboard = route === "";

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

        <div className="masthead__bar">
          <h1>
            {onLeaderboard ? (
              "Surgical intelligence leaderboard"
            ) : (
              <a href="#/">Surgical intelligence leaderboard</a>
            )}
          </h1>
          {!onLeaderboard && (
            <nav className="masthead__nav">
              <a href="#/">Back to the leaderboard</a>
            </nav>
          )}
        </div>
      </header>

      <main>{routeContent(route)}</main>

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
