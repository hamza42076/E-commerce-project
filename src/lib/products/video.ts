/**
 * Product video helpers.
 *
 * No node imports here on purpose — the gallery is a client component and has
 * to be able to work out a thumbnail without asking the server. Everything
 * below is string manipulation on a URL.
 */

/** Whether this product has a video worth offering. */
export function hasVideo(video: string | undefined | null): video is string {
  return typeof video === "string" && video.trim().length > 0;
}

/**
 * A still frame to use as the video's thumbnail and its poster.
 *
 * Cloudinary will render any frame of a hosted video as an image: ask for the
 * same path with an image extension and `so_1` — the frame one second in,
 * rather than frame zero, which on a phone clip is often a blur before the
 * camera has settled.
 *
 * Returns null for a video hosted anywhere else, and the caller falls back to
 * the product's own photo. Guessing a thumbnail URL for a host whose rules we
 * do not know would just produce a broken image.
 */
export function videoPoster(video: string): string | null {
  const marker = "/video/upload/";
  const at = video.indexOf(marker);
  if (at === -1 || !video.includes("res.cloudinary.com")) return null;

  let after = video.slice(at + marker.length);

  // The stored URL already carries `f_auto,q_auto` from the upload. Drop it
  // rather than stacking a second transformation on top: Cloudinary does
  // tolerate the chain, but the duplicate is noise in every `src` on the page
  // and it is one more thing that has to keep being tolerated.
  //
  // A transformation segment is `key_value` pairs; a version is `v` followed by
  // digits, and the public id is a plain name. Only the first matches.
  const firstSlash = after.indexOf("/");
  if (firstSlash > 0) {
    const first = after.slice(0, firstSlash);
    if (!/^v\d+$/.test(first) && /^[a-z]+_[^/]+$/.test(first)) {
      after = after.slice(firstSlash + 1);
    }
  }

  // Swap the container extension for one Cloudinary can render as a picture.
  const asImage = after.replace(/\.(mp4|mov|webm|m4v|ogv)$/i, ".jpg");
  // No extension at all — a delivery URL may omit it — so add one.
  const withExtension =
    asImage === after && !/\.\w{3,4}$/.test(after) ? `${after}.jpg` : asImage;

  // `so_1` is the frame one second in, rather than frame zero, which on a phone
  // clip is often a blur before the camera has settled.
  return `${video.slice(0, at + marker.length)}so_1,f_auto,q_auto/${withExtension}`;
}
