import "server-only";
import type { Capability } from "../auth/roles";
import { RESOURCES } from "./resources";

export type AdminNavItem = { label: string; href: string; cap: Capability; badge?: "messages" | "trash" };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

const content = (key: string): AdminNavItem => {
  const r = RESOURCES.find((x) => x.key === key)!;
  return { label: r.plural, href: `/admin/content/${r.key}`, cap: "content.view" };
};

/** The sidebar. Items a role cannot open are removed before it is drawn. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Website",
    items: [
      { label: "Pages", href: "/admin/pages", cap: "content.view" },
      { label: "Page Content", href: "/admin/page-content", cap: "content.view" },
      { label: "Navigation", href: "/admin/navigation", cap: "settings.manage" },
      content("hero-slides"),
      content("faqs"),
    ],
  },
  {
    label: "Stories",
    items: [content("posts"), content("categories"), content("authors"), content("testimonials")],
  },
  {
    label: "Programs",
    items: [content("programs"), content("stats"), content("learning-centers")],
  },
  {
    label: "People",
    items: [content("team"), content("team-groups")],
  },
  {
    label: "Media",
    items: [
      { label: "Media Library", href: "/admin/media", cap: "media.view" },
      content("gallery"),
      content("gallery-categories"),
    ],
  },
  {
    label: "Inbox",
    items: [
      { label: "Messages", href: "/admin/messages", cap: "submissions.view", badge: "messages" },
      { label: "Newsletter", href: "/admin/newsletter", cap: "submissions.view" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Trash", href: "/admin/trash", cap: "content.view", badge: "trash" },
      { label: "Activity Log", href: "/admin/activity", cap: "activity.view" },
      { label: "Users & Roles", href: "/admin/users", cap: "users.manage" },
      { label: "Settings", href: "/admin/settings", cap: "settings.manage" },
      { label: "API Access", href: "/admin/api-access", cap: "content.create" },
      { label: "Backups", href: "/admin/backups", cap: "backups.manage" },
    ],
  },
];
