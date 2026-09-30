export function Rating({
  value,
  reviewCount,
  className = "",
}: {
  value: number;
  reviewCount?: number;
  className?: string;
}) {
  const filled = Math.round(value);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="flex" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <svg
            key={i}
            viewBox="0 0 20 20"
            className={`h-3.5 w-3.5 ${i < filled ? "fill-accent-400" : "fill-line-strong"}`}
          >
            <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
          </svg>
        ))}
      </span>
      <span className="text-xs text-muted">
        {value.toFixed(1)}
        {reviewCount !== undefined && ` (${reviewCount})`}
      </span>
      <span className="sr-only">
        Rated {value.toFixed(1)} out of 5
        {reviewCount !== undefined && ` from ${reviewCount} reviews`}
      </span>
    </div>
  );
}
