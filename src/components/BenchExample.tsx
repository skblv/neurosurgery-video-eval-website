import type { BenchExampleSpec } from "../data/benchExample";

function OptionList({ options }: { options: string[] }) {
  return (
    <ul className="bench-example__options">
      {options.map((option) => (
        <li key={option}>{option}</li>
      ))}
    </ul>
  );
}

export function BenchExample({ example }: { example: BenchExampleSpec }) {
  const hint =
    example.selection === "any"
      ? "Select every matching label."
      : "Choose one label.";

  return (
    <details className="bench-example">
      <summary className="bench-example__summary">
        <span className="bench-example__arrow" aria-hidden="true" />
        Example
      </summary>
      <div className="bench-example__panel">
        <div className="bench-example__frame" role="img" aria-label="surgical frame">
          [surgical frame]
        </div>
        <div className="bench-example__body">
          <p className="bench-example__question">{example.question}</p>
          <p className="bench-example__hint">
            {example.groups ? "Choose one phase and one step." : hint}
          </p>
          {example.groups
            ? example.groups.map((group) => (
                <div key={group.label} className="bench-example__group">
                  <p className="bench-example__group-label">{group.label}</p>
                  <OptionList options={group.options} />
                </div>
              ))
            : (
              <OptionList options={example.options} />
            )}
        </div>
      </div>
    </details>
  );
}
