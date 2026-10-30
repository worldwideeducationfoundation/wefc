import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { siteUrl } from "@/lib/site-url";
import { getSiteSettings } from "@/server/settings";

/**
 * Every page reads its content from the database at request time, so a
 * change saved in the admin is live on the next page load, and the build
 * never needs the database. Reads are cached in memory (src/server/cache.ts)
 * and the cache is cleared on every admin save.
 */
export const dynamic = "force-dynamic";

/** Shared social card, 1200x630. */
const OG_IMAGE = "/og.png";

/*
 * The two faces of the old site, self-hosted from src/app/fonts (latin
 * subset, variable): Fraunces for headings, with its optical-size axis, and
 * Jost for text. Files in the repo rather than next/font/google so the build
 * never depends on reaching Google Fonts. The admin uses them too.
 */
const fraunces = localFont({
  variable: "--font-fraunces",
  src: [
    { path: "./fonts/fraunces.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/fraunces-italic.woff2", style: "italic", weight: "100 900" },
  ],
  display: "swap",
});
const jost = localFont({ variable: "--font-jost", src: [{ path: "./fonts/jost.woff2", weight: "100 900" }], display: "swap" });

/**
 * Site-wide metadata, from Admin -> Settings. Every route inherits this and
 * overrides only what differs, so no page can ship without an OG image or a
 * canonical. If the database is unreachable the defaults still apply.
 */
export async function generateMetadata(): Promise<Metadata> {
  let name = "Worldwide Education Fund Canada";
  let shortName = "Worldwide Education Fund Canada";
  let tagline = "Education in Chitral & Central Asia";
  let description =
    "Worldwide Education Fund Canada is a registered Canadian charity running early childhood learning centers, teacher training and scholarships in Chitral, Pakistan and Central Asia.";
  try {
    const s = await getSiteSettings();
    ({ name, shortName, tagline, description } = s);
  } catch {
    /* defaults above */
  }

  return {
    metadataBase: new URL(siteUrl),
    title: { default: `${name} | ${tagline}`, template: `%s | ${shortName}` },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: name,
      locale: "en_CA",
      url: "/",
      title: `${name} | ${tagline}`,
      description,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | ${tagline}`,
      description,
      images: [OG_IMAGE],
    },
    icons: { icon: [{ url: "/brand/favicon.png", type: "image/png" }], apple: "/brand/favicon.png" },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
  };
}

/** No `maximum-scale`, no `user-scalable=0`: pinch-zoom must always work (WCAG 1.4.4). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#173210",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${jost.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
