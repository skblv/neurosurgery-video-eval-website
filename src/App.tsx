import { Leaderboard } from "./components/Leaderboard";
import { boothLogo, sdscLogo } from "./assets/logos";
import { PAPER } from "./data/benchmark";

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
