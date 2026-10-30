import type { NextConfig } from "next";

/**
 * 301s from the old static site's URLs, which lived under /pages/ and also
 * answered with ".html". Kept here rather than in the host config so they are
 * versioned with the app and survive a redeploy.
 */
const PAGE_MOVES: [string, string][] = [
  ["mission", "/mission"],
  ["centers", "/centers"],
  ["gallery", "/gallery"],
  ["contact", "/contact"],
  ["active-projects", "/projects"],
  ["project-updates", "/updates"],
  ["success-stories", "/stories"],
];
const legacyRedirects = [
  ...PAGE_MOVES.flatMap(([old, to]) => [
    { from: `/pages/${old}`, to },
    { from: `/pages/${old}.html`, to },
  ]),
  ...["projects", "updates", "stories", "topics"].flatMap((dir) => [
    { from: `/pages/${dir}/:slug.html`, to: `/${dir}/:slug` },
    { from: `/pages/${dir}/:slug`, to: `/${dir}/:slug` },
  ]),
  { from: "/team/index.html", to: "/team" },
  { from: "/donate/index.html", to: "/donate" },
  { from: "/index.html", to: "/" },

  // The /blog/ section of the WordPress site, already redirected by the static site.
  { from: "/blog/bright-beginnings-early-childhood-centers", to: "/projects/bright-beginnings-eclc" },
  { from: "/blog/herzing-daya-research-learning-hub-at-university-of-chitral", to: "/projects/herzing-daya-research-hub" },
  {
    from: "/blog/herzing-training-skills-development-program-at-university-of-chitral",
    to: "/projects/herzing-training-skills-development",
  },
  { from: "/blog/category/:rest*", to: "/updates" },
  { from: "/blog", to: "/updates" },
];

/**
 * The content security policy: the site's own scripts, styles, fonts and
 * images, plus exactly the third parties the pages use —
 *   donorbox.org             the donation form, progress bar and donor wall (iframes)
 *   server.arcgisonline.com,
 *   *.tile.openstreetmap.org the learning-centers map tiles
 *   YouTube                  videos placed in posts or built pages
 *   'self' in frame-src      the ECLC brochure PDF, shown in a frame on the home page
 * 'unsafe-inline' remains for scripts and styles because Next.js inlines its
 * bootstrap code. Production only: the dev server needs eval for reloading.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://donorbox.org",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://server.arcgisonline.com https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://donorbox.org",
  "frame-src 'self' https://donorbox.org https://www.youtube-nocookie.com https://www.youtube.com",
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://donorbox.org",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // payment=(self "https://donorbox.org"): the embedded form may use Apple Pay / Google Pay.
  { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://donorbox.org"), usb=()' },
  ...(process.env.NODE_ENV === "production"
    ? [
        { key: "Content-Security-Policy", value: CSP },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js" header telling scanners what to try.
  poweredByHeader: false,

  images: {
    /* Every image is local: the brand files in public/ and the media
       library served from /uploads (stored on the server, not in git). */
    formats: ["image/avif", "image/webp"],
    // Tuned for the breakpoints we actually test at (§9) rather than
    // Next's defaults — matters on mobile connections in Chitral.
    deviceSizes: [360, 480, 768, 1024, 1280, 1440, 1920],
    imageSizes: [64, 128, 256, 384],
    /* Uploaded files never change in place (a replaced image gets a new
       name), so optimised copies can be kept for a long time. */
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  experimental: {
    /* The host reports 54 cores, and one build worker per core ran the
       shared plan out of memory (SIGABRT while generating pages). */
    cpus: 2,
    serverActions: {
      /* Long posts and built pages are saved as one JSON document. Images
         are uploaded separately (src/app/admin/api/media/route.ts). */
      bodySizeLimit: "4mb",
    },
  },

  /* sharp and mysql2 are native/Node-only; load them from node_modules at
     runtime rather than bundling them. */
  serverExternalPackages: ["sharp", "mysql2"],

  async headers() {
    // When two rules set the same header the later one wins, so the admin's
    // stricter values come after the site-wide ones.
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },

  async redirects() {
    // `permanent: true` would emit 308; old inbound links expect a 301.
    return [
      // One canonical host: www goes to the apex, as the old .htaccess did.
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "www.wefcanada.org" }],
        destination: "https://wefcanada.org/:path*",
        statusCode: 301 as const,
      },
      ...legacyRedirects.map(({ from, to }) => ({ source: from, destination: to, statusCode: 301 as const })),
    ];
  },
};

export default nextConfig;
