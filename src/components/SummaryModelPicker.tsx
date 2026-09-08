import { useEffect, useRef, useState } from "react";
import { SUMMARY_ROWS } from "../data/summary";
import { ModelIcon } from "./ModelIcon";
import { matchesModelSearch } from "../data/modelSearch";

export function SummaryModelPicker({ modelId, excluded, color, onChoose }: {
  modelId?: string;
  excluded: string[];
  color?: string;
  onChoose: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const model = SUMMARY_ROWS.find((row) => row.id === modelId);
  const options = SUMMARY_ROWS.filter((row) => (row.id === modelId || !excluded.includes(row.id)) && matchesModelSearch(row.model, query));

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return <div className="summary-picker" ref={root} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className={model ? "summary-picker-trigger" : "summary-add"}
      aria-expanded={open} aria-label={model ? `Change ${model.model}` : "Add model to plot"}
      onClick={() => { setQuery(""); setOpen((previous) => !previous); }}>
      {model ? <><span className="summary-swatch" style={{ background: color }} /><ModelIcon provider={model.provider} size={18} /><span>{model.model}</span><span className="summary-chevron" aria-hidden="true">⌄</span></> : <><span aria-hidden="true">+</span> Add model</>}
    </button>
    {open ? <div className="summary-picker-options" role="group" aria-label="Choose a model">
      <input ref={search} className="summary-picker-search" type="search" placeholder="Search models…" aria-label="Search models" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); root.current?.querySelector<HTMLButtonElement>(".summary-picker-option")?.focus(); }
        if (event.key === "Enter" && options.length === 1) { onChoose(options[0].id); setOpen(false); trigger.current?.focus(); }
      }} />
      {options.length === 0 ? <p className="summary-picker-empty">No matching models</p> : null}
      {options.map((row) => <button
        key={row.id} type="button" className={row.id === modelId ? "summary-picker-option summary-picker-option--selected" : "summary-picker-option"}
        aria-pressed={row.id === modelId} onClick={() => { onChoose(row.id); setOpen(false); trigger.current?.focus(); }}>
        <ModelIcon provider={row.provider} size={18} /><span>{row.model}</span>{row.id === modelId ? <span aria-hidden="true">✓</span> : null}
      </button>)}
    </div> : null}
  </div>;
}
