import { useEffect, useId, useState, type RefObject } from "react";
import { copyPngToClipboard, plotPng } from "../data/plotExport";
import { PLOT_BRANDING } from "../data/plotBranding";

export function PlotCopyButton({ plotRef, title, subtitle = "", methodology }: {
  plotRef: RefObject<SVGSVGElement | null>; title: string; subtitle?: string; methodology: string;
}) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const errorId = useId();
  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);
  const copy = () => {
    const plot = plotRef.current;
    if (!plot || state === "copying") return;
    setState("copying");
    void copyPngToClipboard(() => plotPng(plot, title, subtitle, methodology, PLOT_BRANDING)).then(
      () => setState("copied"), () => setState("failed"),
    );
  };
  return <div className="plot-copy-control">
    <button className="plot-copy" type="button" onClick={copy} disabled={state === "copying"}
      aria-label="Copy plot as PNG" title="Copy plot as PNG" aria-busy={state === "copying"}
      aria-describedby={state === "failed" ? errorId : undefined}>
      <svg className="plot-copy-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {state === "copied" ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></>}
      </svg>
    </button>
    {state === "failed" ? <span id={errorId} role="alert" className="plot-copy-error">Could not copy the image. Allow clipboard access and try again.</span> : null}
  </div>;
}
