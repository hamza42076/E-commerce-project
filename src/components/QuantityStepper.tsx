"use client";

export function QuantityStepper({
  value,
  max,
  onChange,
  label = "Quantity",
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  label?: string;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className="rounded-l-lg px-2.5 py-1.5 text-muted transition hover:bg-surface-sunken hover:text-ink active:scale-90"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      <span className="min-w-7 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
        className="rounded-r-lg px-2.5 py-1.5 text-muted transition hover:bg-surface-sunken hover:text-ink active:scale-90 disabled:cursor-not-allowed disabled:text-subtle disabled:hover:bg-transparent disabled:active:scale-100"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
