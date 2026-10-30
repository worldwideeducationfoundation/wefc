/**
 * The menus the site launched with. The site reads its menus from Admin ->
 * Navigation; these are the fallback for a fresh database (nothing saved
 * yet) or an outage, so the header never renders empty.
 *
 * Mirrors the navigation of the old static wefcanada.org. A top-level entry
 * with children and the address "#" is a dropdown heading only.
 */

import type { FooterGroup, NavLink } from "./types";

export const headerNav: NavLink[] = [
  { label: "Home", href: "/" },
  {
    label: "About",
    href: "#",
    children: [
      { label: "Our Team", href: "/team" },
      { label: "Our Mission", href: "/mission" },
    ],
  },
  {
    label: "Impact",
    href: "#",
    children: [
      { label: "Learning Centers Map", href: "/centers" },
      { label: "Success Stories", href: "/stories" },
      { label: "Project Updates", href: "/updates" },
    ],
  },
  {
    label: "What We Do",
    href: "#",
    children: [{ label: "Active Projects", href: "/projects" }],
  },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
];

export const footerNav: FooterGroup[] = [
  {
    heading: "Explore",
    links: [
      { label: "Our Team", href: "/team" },
      { label: "Our Mission", href: "/mission" },
      { label: "Gallery", href: "/gallery" },
      { label: "Success Stories", href: "/stories" },
    ],
  },
  {
    heading: "Get Involved",
    links: [
      { label: "Donate", href: "https://donorbox.org/bright-beginnings-early-childhood-learning-centers-eclcs" },
      { label: "Ways to Give", href: "/donate" },
      { label: "Contact Us", href: "/contact" },
      { label: "Active Projects", href: "/projects" },
    ],
  },
];
