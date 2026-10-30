/**
 * The inline SVG icons the site uses, copied from the old static pages so
 * they draw exactly as before. All are decorative (aria-hidden): every icon
 * sits beside text, or inside a control that carries its own label.
 */

type P = { className?: string };
const line = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ArrowRight = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const ArrowLeft = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);
export const ChevronLeft = ({ width = "2.2" }: { width?: string }) => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth={width} aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const ChevronRight = ({ width = "2.2" }: { width?: string }) => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth={width} aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const Caret = () => (
  <svg className="wef-caret" viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const Close = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const Heart = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" />
  </svg>
);
export const HeartLine = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="1.7" aria-hidden="true">
    <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" />
  </svg>
);
export const Shield = ({ width = "2" }: { width?: string }) => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth={width} aria-hidden="true">
    <path d="M12 2 4 5v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V5l-8-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const Eye = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="1.7" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const Lock = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
export const External = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
export const Check = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2.2" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const Dot = () => (
  <svg viewBox="0 0 8 8" aria-hidden="true">
    <circle cx="4" cy="4" r="3" />
  </svg>
);
export const Pin = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
export const Calendar = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
export const Clock = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);
export const Mail = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </svg>
);
export const Phone = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);
export const MapPin = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
export const Star = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5l2.77 6.62 7.15.62-5.43 4.71 1.64 6.98L12 17.5l-6.13 3.93 1.64-6.98-5.43-4.71 7.15-.62z" />
  </svg>
);
export const Send = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);
export const Info = () => (
  <svg viewBox="0 0 24 24" {...line} strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

/* Value icons on the home page, in order. */
export const VALUE_ICONS = [
  <svg key="1" viewBox="0 0 24 24" {...line} strokeWidth="1.8" aria-hidden="true">
    <path d="M12 22V12" />
    <path d="M12 12C12 8 9 5 5 5c0 4 2 7 7 7z" />
    <path d="M12 12c0-4 3-7 7-7 0 4-2 7-7 7z" />
  </svg>,
  <svg key="2" viewBox="0 0 24 24" {...line} strokeWidth="1.8" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>,
  <svg key="3" viewBox="0 0 24 24" {...line} strokeWidth="1.8" aria-hidden="true">
    <path d="M12 3v18" />
    <path d="M5 7h14" />
    <path d="M5 7l-3 6a3 3 0 0 0 6 0z" />
    <path d="M19 7l-3 6a3 3 0 0 0 6 0z" />
  </svg>,
  <svg key="4" viewBox="0 0 24 24" {...line} strokeWidth="1.8" aria-hidden="true">
    <circle cx="8" cy="12" r="4" />
    <circle cx="16" cy="12" r="4" />
  </svg>,
];

/* Social networks, keyed as in Settings. */
export const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25H21.552L14.325 10.51L22.827 21.75H16.17L10.956 14.933L4.99 21.75H1.68L9.41 12.915L1.254 2.25H8.08L12.793 8.481L18.244 2.25ZM17.083 19.77H18.916L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.78 90.69 226.38 209.25 245V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.28c-30.8 0-40.41 19.12-40.41 38.73V256h68.78l-11 71.69h-57.78V501C413.31 482.38 504 379.78 504 256z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
      <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
      <path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 576 512" fill="currentColor" aria-hidden="true">
      <path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z" />
    </svg>
  ),
  trustpilot: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.77 6.62 7.15.62-5.43 4.71 1.64 6.98L12 17.5l-6.13 3.93 1.64-6.98-5.43-4.71 7.15-.62z" />
    </svg>
  ),
};
