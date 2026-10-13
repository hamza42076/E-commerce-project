// No "server-only" here on purpose: the signing routine is covered by a test
// that runs under plain Node, and the node:crypto import already keeps this
// file out of any client bundle.
import { createHash } from "node:crypto";

/**
 * Signed, server-side uploads to Cloudinary.
 *
 * No SDK: a signed upload is one POST and a SHA-1, and doing it directly keeps
 * the dependency list short and makes it obvious exactly what leaves the
 * server.
 *
 * The signature is built here, on the server, from the API secret — which
 * therefore never reaches the browser. An *unsigned* preset would be simpler
 * but would let anyone who learned the cloud name upload into the account.
 */

const FOLDER = "smartshop";

type Credentials = { cloudName: string; apiKey: string; apiSecret: string };

/**
 * Credentials come either as the single CLOUDINARY_URL the dashboard hands out
 * — `cloudinary://<key>:<secret>@<cloud>` — or as three separate variables.
 * The combined form wins when both are present, since it is the one copied
 * straight from Cloudinary and so the less likely to be half-updated.
 *
 * Parsed with a pattern rather than `new URL`, which lowercases the host.
 */
function readCredentials(): Credentials | null {
  const combined = process.env.CLOUDINARY_URL?.trim();
  if (combined) {
    const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(combined);
    if (match) {
      return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
    }
    console.error(
      "[cloudinary] CLOUDINARY_URL is set but malformed. Expected " +
        "cloudinary://<api_key>:<api_secret>@<cloud_name>",
    );
    return null;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };

  return null;
}

export function isCloudinaryConfigured(): boolean {
  return readCredentials() !== null;
}

/**
 * Cloudinary signs the alphabetically sorted parameters, joined as a query
 * string, with the API secret appended. Only the parameters actually sent are
 * included.
 */
export function signParams(params: Record<string, string>, secret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(canonical + secret).digest("hex");
}

/**
 * Asks Cloudinary to deliver the image rather than the original file:
 * `f_auto` picks the best format the browser accepts (WebP or AVIF instead of
 * PNG), `q_auto` picks a quality that looks the same but weighs far less.
 *
 * On the catalogue photograph this turns a 2.1 MB PNG into a 176 KB WebP — the
 * difference between a page that opens on mobile data and one that does not.
 * Cloudinary does the conversion once and caches it; the original is untouched.
 */
function optimised(secureUrl: string): string {
  const marker = "/image/upload/";
  const at = secureUrl.indexOf(marker);
  if (at === -1) return secureUrl;
  return (
    secureUrl.slice(0, at + marker.length) +
    "f_auto,q_auto/" +
    secureUrl.slice(at + marker.length)
  );
}

/**
 * The same idea as `optimised`, for a video.
 *
 * Cloudinary transcodes on demand, so a 5 MB phone clip is delivered as
 * whatever the browser handles best at a sensible bitrate. `q_auto` matters
 * more here than on an image: a product video is the heaviest thing on the
 * page, and nobody on mobile data waits for the original.
 */
function optimisedVideo(secureUrl: string): string {
  const marker = "/video/upload/";
  const at = secureUrl.indexOf(marker);
  if (at === -1) return secureUrl;
  return (
    secureUrl.slice(0, at + marker.length) +
    "f_auto,q_auto/" +
    secureUrl.slice(at + marker.length)
  );
}

export type CloudinaryResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/**
 * Uploads already-validated bytes. The caller checks that this is an admin,
 * that the file is within the size limit and that its leading bytes really are
 * JPG, PNG or WebP — none of that is re-done here, and none of it is delegated
 * to Cloudinary.
 */
export async function uploadToCloudinary(
  bytes: Uint8Array,
  extension: string,
): Promise<CloudinaryResult> {
  const credentials = readCredentials();
  if (!credentials) {
    return { ok: false, message: "Image uploads are not configured." };
  }
  const { cloudName, apiKey, apiSecret } = credentials;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed: Record<string, string> = { folder: FOLDER, timestamp };
  const signature = signParams(signed, apiSecret);

  const body = new FormData();
  // The name is ours, not the uploader's, for the same reason as the local
  // path: a crafted filename should never decide where a file lands.
  body.append("file", new Blob([new Uint8Array(bytes)]), `upload${extension}`);
  body.append("folder", FOLDER);
  body.append("timestamp", timestamp);
  body.append("api_key", apiKey);
  body.append("signature", signature);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body },
    );

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      // Cloudinary's own wording can mention the account; log it, do not show it.
      const detail =
        typeof payload === "object" && payload !== null && "error" in payload
          ? String((payload as { error?: { message?: string } }).error?.message)
          : `HTTP ${response.status}`;
      console.error(`[cloudinary] Upload rejected: ${detail}`);
      return { ok: false, message: "Could not save the image. Try again." };
    }

    const url =
      typeof payload === "object" && payload !== null && "secure_url" in payload
        ? String((payload as { secure_url?: string }).secure_url)
        : "";

    if (!url.startsWith("https://")) {
      console.error("[cloudinary] Upload succeeded but returned no secure_url.");
      return { ok: false, message: "Could not save the image. Try again." };
    }

    return { ok: true, url: optimised(url) };
  } catch (error) {
    console.error("[cloudinary] Upload failed:", error);
    return { ok: false, message: "Could not reach the image service. Try again." };
  }
}

/**
 * Uploads a product video. Same signed POST as an image, to Cloudinary's
 * `video/upload` endpoint instead.
 *
 * As with images, the caller has already checked that this is an admin, that
 * the file is within the size limit, and that its leading bytes really are the
 * format they claim. Cloudinary is not asked to police any of that.
 *
 * Uploading a video takes Cloudinary longer than an image — it has to be read
 * and probed before the response comes back — so this is slower than it looks.
 */
export async function uploadVideoToCloudinary(
  bytes: Uint8Array,
  extension: string,
): Promise<CloudinaryResult> {
  const credentials = readCredentials();
  if (!credentials) {
    return { ok: false, message: "Video uploads are not configured." };
  }
  const { cloudName, apiKey, apiSecret } = credentials;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed: Record<string, string> = { folder: FOLDER, timestamp };
  const signature = signParams(signed, apiSecret);

  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(bytes)]), `upload${extension}`);
  body.append("folder", FOLDER);
  body.append("timestamp", timestamp);
  body.append("api_key", apiKey);
  body.append("signature", signature);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      { method: "POST", body },
    );

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        typeof payload === "object" && payload !== null && "error" in payload
          ? String((payload as { error?: { message?: string } }).error?.message)
          : `HTTP ${response.status}`;
      console.error(`[cloudinary] Video upload rejected: ${detail}`);
      return { ok: false, message: "Could not save the video. Try again." };
    }

    const url =
      typeof payload === "object" && payload !== null && "secure_url" in payload
        ? String((payload as { secure_url?: string }).secure_url)
        : "";

    if (!url.startsWith("https://")) {
      console.error("[cloudinary] Video upload succeeded but returned no secure_url.");
      return { ok: false, message: "Could not save the video. Try again." };
    }

    return { ok: true, url: optimisedVideo(url) };
  } catch (error) {
    console.error("[cloudinary] Video upload failed:", error);
    return { ok: false, message: "Could not reach the video service. Try again." };
  }
}
