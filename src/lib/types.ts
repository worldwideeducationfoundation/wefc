import type { RichDoc } from "./richtext";

/**
 * The shapes the public site renders. The data layer (src/server/content.ts)
 * reads the database and returns exactly these, so components never see a
 * database row and do not care where the content came from.
 */

export type MediaRef = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** "application/pdf" for documents; images are always WebP. */
  mime?: string;
};

export type Stat = {
  value: string;
  label: string;
  note?: string;
};

export type ProgramPlacement = "strip" | "home" | "mission";

/** A program card. Which fields are drawn depends on where it is placed. */
export type ProgramCard = {
  id: number;
  title: string;
  lead: string;
  badge?: string;
  category?: string;
  accent?: string;
  points: string[];
  stats: Stat[];
  /** Mission rows: Where / Who / Impact and the like. */
  columns: { heading: string; items: string[] }[];
  notes: string[];
  image?: MediaRef;
  href?: string;
  /** Mission rows: the expandable tracks inside this card. */
  tracks: ProgramCard[];
  parentId: number | null;
};

export type HeroSlideContent = {
  id: string;
  description: string;
  image?: MediaRef;
};

export type LearningCenter = {
  name: string | null;
  village: string;
  region: string | null;
  model: string | null;
  sponsor: string | null;
  enrollment: number | null;
  lat: number | null;
  lon: number | null;
};

export type Faq = { question: string; answer: RichDoc };

export type TeamMember = {
  id: number;
  name: string;
  role?: string;
  bio?: string;
  linkedin?: string;
  image?: MediaRef;
};

export type TeamGroup = { heading: string; eyebrow?: string; description?: string; members: TeamMember[] };

export type GalleryPhoto = MediaRef & { caption?: string | null; category?: string | null };

export type Testimonial = {
  quote: string;
  name?: string;
  context?: string;
  location?: string;
  image?: MediaRef;
  href?: string;
};

export type NavLink = {
  label: string;
  href: string;
  children?: NavLink[];
};

export type FooterGroup = { heading: string; links: NavLink[] };

export type SiteSettings = {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  charityNumber: string;
  phone: string;
  phoneHref: string;
  email: string;
  address: { line1: string; line2: string; region: string; postcode: string; country: string };
  /** The address on one line, without the country. */
  addressLine: string;
  contactTopics: string[];
  donateUrl: string;
  donorboxCampaign: string;
  socials: { key: string; label: string; href: string }[];
  trustpilot: string;
};

export type CategoryRef = {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  postCount?: number;
};

export type AuthorRef = {
  name: string;
  role?: string | null;
  bio?: string | null;
};

export type PostSection = "update" | "story" | "project";

export type PostCard = {
  id: number;
  section: PostSection;
  title: string;
  /** The shorter heading for list cards (falls back to the title). */
  cardTitle: string;
  slug: string;
  href: string;
  excerpt: string;
  publishedAt: string;
  dateLabel?: string | null;
  location?: string | null;
  featured: boolean;
  image?: MediaRef;
  author?: AuthorRef | null;
  categories: CategoryRef[];
};

export type PostCta = {
  heading: string;
  text: string;
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel?: string | null;
  secondaryUrl?: string | null;
};

export type Post = PostCard & {
  body: RichDoc;
  /** Images used inside the body, by media id. */
  bodyMedia: Record<number, MediaRef>;
  status: "draft" | "published";
  updatedAt: string;
  cta: Partial<PostCta>;
  seo: { title?: string | null; description?: string | null };
};
