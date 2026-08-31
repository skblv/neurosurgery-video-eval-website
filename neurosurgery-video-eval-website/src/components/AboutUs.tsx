import { useEffect, useState } from "react";

import kirillPhoto from "../assets/portraits/kirill-skobelev.jpg";
import nanaPhoto from "../assets/portraits/zhuang-fang-yi.jpg";
import { PAPER } from "../data/benchmark";

type CopyState = "idle" | "copied" | "failed";

const COPY_STATUS_RESET_MS = 2000;

const MAINTAINERS = [
  {
    id: "kirill-skobelev",
    name: "Kirill Skobelev",
    role: "CS PhD student at Northwestern",
    photo: kirillPhoto,
    links: [
      { href: "https://skobelev.me", label: "skobelev.me" },
      {
        href: "https://www.linkedin.com/in/skobelevkirill/",
        label: "LinkedIn",
      },
    ],
  },
  {
    id: "zhuang-fang-yi",
    name: "Zhuang-Fang (NaNa) Yi, PhD",
    role: "Lead ML Engineer at SDSC",
    photo: nanaPhoto,
    links: [
      {
        href: "https://www.linkedin.com/in/zhuang-fang-yi-phd-01178a34/",
        label: "LinkedIn",
      },
    ],
  },
] as const;

function copyButtonLabel(state: CopyState): string {
  switch (state) {
    case "idle":
      return "Copy citation";
    case "copied":
      return "Copied";
    case "failed":
      return "Copy failed";
    default: {
      const exhaustive: never = state;
      throw new Error(`Unhandled copy state: ${exhaustive}`);
    }
  }
}

function copyWithExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

/**
 * Footer-adjacent section with the paper BibTeX and the people who keep
 * the leaderboard.
 */
export function AboutUs() {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    if (copyState === "idle") {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setCopyState("idle");
    }, COPY_STATUS_RESET_MS);
    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  const handleCopy = () => {
    if (copyWithExecCommand(PAPER.bibtex)) {
      setCopyState("copied");
      return;
    }
    if (!navigator.clipboard) {
      setCopyState("failed");
      return;
    }
    void navigator.clipboard.writeText(PAPER.bibtex).then(
      () => setCopyState("copied"),
      () => setCopyState("failed"),
    );
  };

  return (
    <section className="about" aria-labelledby="about-heading">
      <h2 id="about-heading">About</h2>

      <ul className="maintainers">
        {MAINTAINERS.map((person) => (
          <li key={person.id} className="maintainer">
            <img
              className="maintainer__photo"
              src={person.photo}
              alt=""
              width={80}
              height={80}
            />
            <div className="maintainer__body">
              <p className="maintainer__name">{person.name}</p>
              <p className="maintainer__role">{person.role}</p>
              <p className="maintainer__links">
                {person.links.map((link, index) => (
                  <span key={link.href}>
                    {index > 0 ? " · " : null}
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                  </span>
                ))}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="citation">
        <button
          type="button"
          className="citation__copy"
          onClick={handleCopy}
        >
          {copyButtonLabel(copyState)}
        </button>
        <pre className="citation__bibtex">{PAPER.bibtex}</pre>
        {copyState === "failed" ? (
          <p className="citation__error" role="alert">
            Could not copy the citation. Select the BibTeX and copy it
            manually.
          </p>
        ) : null}
      </div>
    </section>
  );
}
