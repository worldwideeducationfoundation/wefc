import type { MediaRef } from "./types";

/**
 * Responsive versions of media-library images.
 *
 * Uploads are stored once, up to 2400px wide. Sending that file to a phone
 * costs ~600 KB where ~40 KB would do — on mobile data in Chitral, and in the
 * Core Web Vitals search engines rank on. Next's image optimiser resizes and
 * re-encodes on request (AVIF/WebP, by the browser's Accept header) and caches
 * the result, so a plain <img> with this srcset gets the right file for every
 * screen without the next/image component's client JavaScript.
 *
 * The widths must be the ones allowed in next.config.ts (images.deviceSizes).
 */
const WIDTHS = [360, 480, 768, 1024, 1280, 1440, 1920] as const;

function optimisable(src: string) {
  return src.startsWith("/uploads/") && !src.toLowerCase().endsWith(".pdf");
}

/** One resized copy, or the original for anything the optimiser should not touch. */
export function imageUrl(src: string, width: number): string {
  if (!optimisable(src)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

/**
 * src, srcSet and sizes for an <img>. `sizes` says how wide the image is
 * drawn on the page, so the browser can pick the smallest file that is sharp.
 */
export function responsiveImage(image: Pick<MediaRef, "src" | "width">, sizes: string) {
  if (!optimisable(image.src)) return { src: image.src };
  const natural = image.width || WIDTHS[WIDTHS.length - 1];
  // Never upscale: stop at the first allowed width that covers the original.
  const widths = WIDTHS.filter((w, i) => w <= natural || WIDTHS[i - 1] < natural);
  return {
    src: imageUrl(image.src, widths.includes(1024) ? 1024 : widths[widths.length - 1]),
    srcSet: widths.map((w) => `${imageUrl(image.src, w)} ${w}w`).join(", "),
    sizes,
  };
}
