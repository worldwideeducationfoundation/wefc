import type { Metadata } from "next";
import { SiteChrome } from "@/components/site/SiteChrome";
import NotFoundPage from "./(site)/not-found";
import "leaflet/dist/leaflet.css";
import "@/styles/wef-chrome.css";
import "@/styles/site.css";
import "@/styles/pages/notfound.css";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/** Addresses no route matched at all; rendered inside the site's own frame. */
export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundPage />
    </SiteChrome>
  );
}
