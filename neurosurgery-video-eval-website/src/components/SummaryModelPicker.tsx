import { useEffect, useId, useRef, useState } from "react";
import { SUMMARY_TABLE_ROWS } from "../data/summary";
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const search = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const model = SUMMARY_TABLE_ROWS.find((row) => row.id === modelId);
  const options = SUMMARY_TABLE_ROWS.filter((row) => (row.id === modelId || !excluded.includes(row.id)) && matchesModelSearch(row.model, query));
  const activeOptionId = activeIndex >= 0 && activeIndex < options.length ? `${listId}-${options[activeIndex].id}` : undefined;

  function choose(id: string) {
    onChoose(id);
    setOpen(false);
    trigger.current?.focus();
  }

  function showOptions() {
    setQuery("");
    setActiveIndex(-1);
    setOpen(true);
  }

  useEffect(() => {
    if (open && activeOptionId) document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeOptionId]);

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
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className={model ? "summary-picker-trigger" : "summary-add"}
      aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? listId : undefined} aria-label={model ? `Change ${model.model}` : "Add model to plot"}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); showOptions(); }
      }}
      onClick={() => { if (open) setOpen(false); else showOptions(); }}>
      {model ? <><span className="summary-swatch" style={{ background: color }} /><ModelIcon provider={model.provider} size={18} /><span>{model.model}</span><span className="summary-chevron" aria-hidden="true">⌄</span></> : <><span aria-hidden="true">+</span> Add model</>}
    </button>
    {open ? <div className="summary-picker-options">
      <input ref={search} className="summary-picker-search" type="search" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeOptionId} placeholder="Search models…" aria-label="Search models" value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); }} onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
          event.preventDefault();
          const direction = event.key === "ArrowDown" ? 1 : -1;
          setActiveIndex((previous) => previous < 0 ? (direction > 0 ? 0 : options.length - 1) : (previous + direction + options.length) % options.length);
        }
        if (event.key === "Enter" && options.length) { event.preventDefault(); choose(options[activeIndex]?.id ?? options[0].id); }
      }} />
      {options.length === 0 ? <p className="summary-picker-empty" role="status">No matching models</p> : null}
      <div id={listId} role="listbox" aria-label="Choose a model">
      {options.map((row, index) => <div
        key={row.id} id={`${listId}-${row.id}`} role="option" aria-selected={row.id === modelId}
        className={`summary-picker-option${row.id === modelId ? " summary-picker-option--selected" : ""}${index === activeIndex ? " summary-picker-option--active" : ""}`}
        onPointerMove={() => setActiveIndex(index)}
        // Keep search focused: some browsers blur it before an option's click fires.
        onPointerDown={(event) => { if (event.button === 0) event.preventDefault(); }}
        onClick={() => choose(row.id)}>
        <ModelIcon provider={row.provider} size={18} /><span>{row.model}</span>{row.id === modelId ? <span aria-hidden="true">✓</span> : null}
      </div>)}
      </div>
    </div> : null}
  </div>;
}
