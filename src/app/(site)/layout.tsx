import { SiteChrome } from "@/components/site/SiteChrome";
import "leaflet/dist/leaflet.css";
import "@/styles/wef-chrome.css";
import "@/styles/site.css";
import "@/styles/pages/home.css";
import "@/styles/pages/mission.css";
import "@/styles/pages/centers.css";
import "@/styles/pages/gallery.css";
import "@/styles/pages/contact.css";
import "@/styles/pages/team.css";
import "@/styles/pages/donate.css";
import "@/styles/pages/list.css";
import "@/styles/pages/article.css";
import "@/styles/pages/notfound.css";
// Shared components after the pages, as the old home page loaded them: where
// a page rule and a component rule tie, the component wins.
import "@/styles/wef-forms.css";
import "@/styles/wef-centers.css";
import "@/styles/wef-filters.css";

/*
 * The old site's stylesheets, all loaded once here. Each page's own sheet is
 * scoped to its wrapper (.pg-home, .pg-team, …), so loading them together
 * cannot let one page restyle another.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <SiteChrome>{children}</SiteChrome>;
}
