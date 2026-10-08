"use client";

import { useState, type ChangeEvent } from "react";
import { uploadProductImageAction } from "@/lib/admin/upload";

/**
 * Uploads through the existing server action, which is the thing that actually
 * validates the file — magic bytes, size, type, generated filename. Nothing
 * here is trusted; this only shows what came back.
 */
async function upload(file: File): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const body = new FormData();
  body.append("file", file);
  const result = await uploadProductImageAction(body);
  return result.ok
    ? { ok: true, url: result.url }
    : { ok: false, message: result.message };
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  return (
    // A local /uploads path or an external URL; next/image would need host config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full rounded-lg border border-line object-cover"
    />
  );
}

/** One image: upload a file, or paste a URL. */
export function MainImagePicker({
  value,
  onChange,
  error,
  label = "Main image",
}: {
  value: string;
  onChange: (url: string) => void;
  error?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFailure(null);
    setBusy(true);
    const result = await upload(file);
    setBusy(false);
    setFileKey((key) => key + 1);

    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    onChange(result.url);
  }

  const showPreview = value.startsWith("http") || value.startsWith("/uploads/");

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium">{label}</span>

      <div className="flex items-start gap-3">
        {showPreview && (
          <div className="h-16 w-16 shrink-0">
            <Thumb src={value} alt="Selected" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <label
            className={`flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-line-strong px-3 py-2 text-center text-xs transition hover:border-brand-400 hover:bg-surface-sunken ${
              busy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {busy ? "Uploading..." : value ? "Replace image" : "Choose image"}
            <input
              key={fileKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFile}
              disabled={busy}
              className="sr-only"
            />
          </label>

          <input
            type="url"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="…or paste an image URL"
            aria-label={`${label} URL`}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs outline-none transition placeholder:text-subtle focus:border-brand-500"
          />

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setFailure(null);
              }}
              className="text-xs text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {(failure || error) && (
        <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{failure ?? error}</p>
      )}
      {!failure && !error && (
        <p className="mt-1.5 text-xs text-subtle">
          JPG, PNG or WebP, up to 5 MB. Leave blank for a generated tile.
        </p>
      )}
    </div>
  );
}

/** Any number of extra images for the same colour. */
export function ExtraImagesPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setFailure(null);
    setBusy(true);

    const added: string[] = [];
    const problems: string[] = [];
    // One at a time: each file is validated on its own, and one bad file should
    // not throw away the good ones alongside it.
    for (const file of files) {
      const result = await upload(file);
      if (result.ok) added.push(result.url);
      else problems.push(`${file.name}: ${result.message}`);
    }

    setBusy(false);
    setFileKey((key) => key + 1);
    if (added.length > 0) onChange([...value, ...added]);
    if (problems.length > 0) setFailure(problems.join(" "));
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium">
        Additional images <span className="font-normal text-subtle">(optional)</span>
      </span>

      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {value.map((url, index) => (
            <li key={`${url}-${index}`} className="relative h-16 w-16">
              <Thumb src={url} alt={`Extra ${index + 1}`} />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={`Remove extra image ${index + 1}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <label
        className={`flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-line-strong px-3 py-2 text-center text-xs transition hover:border-brand-400 hover:bg-surface-sunken ${
          busy ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {busy ? "Uploading..." : "Add images"}
        <input
          key={fileKey}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFiles}
          disabled={busy}
          className="sr-only"
        />
      </label>

      {failure && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{failure}</p>}
    </div>
  );
}
