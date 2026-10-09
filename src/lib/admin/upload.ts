"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth/session";
import { isCloudinaryConfigured, uploadToCloudinary } from "./cloudinary";

export type UploadResult = { ok: true; url: string } | { ok: false; message: string };

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Detects the real format from the file's leading bytes. The browser-supplied
 * MIME type and the filename are both attacker-controlled, so neither is
 * trusted — a .jpg that is actually something else is rejected here.
 *
 * SVG is deliberately unsupported: it can carry script, and these files are
 * served from the site's own origin.
 */
function sniffExtension(bytes: Uint8Array): ".jpg" | ".png" | ".webp" | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return ".jpg";

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => bytes[i] === byte)) return ".png";

  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return ".webp";

  return null;
}

export async function uploadProductImageAction(formData: FormData): Promise<UploadResult> {
  const session = await getSession();
  if (session?.role !== "admin") {
    return { ok: false, message: "You do not have permission to upload." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image first." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "That image is over 5 MB. Use a smaller one." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = sniffExtension(bytes);
  if (!extension) {
    return { ok: false, message: "Only JPG, PNG and WebP images are supported." };
  }

  // Everything above runs whatever the destination is. Cloudinary is not
  // trusted to police file types or sizes on our behalf.
  if (isCloudinaryConfigured()) {
    return uploadToCloudinary(bytes, extension);
  }

  // No Cloudinary configured: write to the local disk, as before. That works
  // on a laptop or a VPS, but a serverless host has a read-only, throwaway
  // filesystem — which is the whole reason Cloudinary is the preferred path.
  console.warn(
    "[upload] Cloudinary is not configured — saving to public/uploads instead.\n" +
      "         Those files are gitignored, so they will not exist on a deploy.",
  );

  // The name is generated, never taken from the upload, so a crafted filename
  // cannot escape the uploads directory or overwrite an existing file.
  const filename = `${randomUUID()}${extension}`;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), bytes);
  } catch (error) {
    console.error("[upload] Could not save the image:", error);
    return { ok: false, message: "Could not save the image. Try again." };
  }

  return { ok: true, url: `/uploads/${filename}` };
}
