import { useEffect, useId, useState, type RefObject } from "react";
import { copyPngToClipboard, plotPng } from "../data/plotExport";
import { PLOT_BRANDING } from "../data/plotBranding";
import { CopyIcon } from "./CopyIcon";

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
      <CopyIcon copied={state === "copied"} />
    </button>
    {state === "failed" ? <span id={errorId} role="alert" className="plot-copy-error">Could not copy the image. Allow clipboard access and try again.</span> : null}
  </div>;
}
