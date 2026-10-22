export function OrderItemImage({
  src,
  name,
}: {
  src: string;
  name: string;
}) {
  if (!src) {
    return (
      <div
        role="img"
        aria-label={`${name} image unavailable`}
        className="flex h-full w-full items-center justify-center bg-surface-sunken text-xs text-muted"
      >
        No image
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="h-full w-full object-cover" />
  );
}
