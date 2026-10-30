import "server-only";
import type { FieldDef, OptionSource } from "@/lib/admin-fields";

/**
 * Every content type the admin manages through the shared list/edit screens.
 *
 * One entry here gives a content type its list (search, filters, sort,
 * drag-to-reorder, bulk publish/unpublish/trash), its edit form, validation,
 * Trash support and activity logging — the same way for every type, so the
 * admin behaves consistently and a new type is a few lines rather than a new
 * set of pages.
 *
 * Table and column names here are the only identifiers ever placed into SQL
 * by the generic code; nothing from a request is.
 */
export type ListColumn = {
  field: string;
  label: string;
  kind?: "text" | "date" | "badge" | "muted";
};

export type ResourceDef = {
  key: string;
  table: string;
  label: string;
  plural: string;
  /** Sidebar group. */
  group: string;
  description: string;
  titleField: string;
  /** Column holding the media id shown as each row's thumbnail. */
  thumbField?: string;
  searchFields: string[];
  columns: ListColumn[];
  filters?: { field: string; label: string; optionsFrom?: OptionSource; options?: { value: string; label: string }[] }[];
  /** "order" = drag to reorder by display_order; otherwise the column to sort by, newest first. */
  defaultSort: "order" | { column: string; dir: "asc" | "desc" };
  fields: FieldDef[];
  /** Where this item appears on the public site, given its row. */
  publicPath?: (row: Record<string, unknown>) => string | null;
  /** Fields copied when an item is duplicated, besides the defaults. */
  newDefaults?: Record<string, unknown>;
  /** Columns holding media ids, for the media library's "where is this used". */
  mediaColumns: string[];
  /** Columns holding rich-text JSON that may reference media. */
  richColumns?: string[];
  /** A slug is unique only among rows sharing this column (posts: per section). */
  slugScope?: string;
};

export const POST_SECTIONS = [
  { value: "update", label: "Project Update", path: "/updates" },
  { value: "story", label: "Success Story", path: "/stories" },
  { value: "project", label: "Active Project", path: "/projects" },
] as const;

export function postPath(section: unknown, slug: unknown): string | null {
  const s = POST_SECTIONS.find((p) => p.value === section);
  return s && slug ? `${s.path}/${slug}` : null;
}

const PROGRAM_PLACEMENTS = [
  { value: "strip", label: "Home — photo strip" },
  { value: "home", label: "Home — Our Programs" },
  { value: "mission", label: "Mission — active projects" },
];

const STAT_PLACEMENTS = [
  { value: "home", label: "Home — impact counters" },
  { value: "mission", label: "Mission — at a glance" },
  { value: "donate", label: "Donate — under the form" },
];

export const RESOURCES: ResourceDef[] = [
  {
    key: "posts",
    table: "posts",
    label: "Post",
    plural: "Posts",
    group: "Stories",
    description: "Project updates, success stories and active-project pages. The kind decides the web address and the list it appears on.",
    titleField: "title",
    thumbField: "image_media_id",
    searchFields: ["title", "card_title", "excerpt", "slug"],
    columns: [
      { field: "section", label: "Kind", kind: "badge" },
      { field: "published_at", label: "Date", kind: "date" },
    ],
    filters: [{ field: "section", label: "Kind", options: POST_SECTIONS.map(({ value, label }) => ({ value, label })) }],
    defaultSort: { column: "published_at", dir: "desc" },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, maxLength: 255 },
      {
        name: "section",
        label: "Kind",
        type: "select",
        required: true,
        half: true,
        options: POST_SECTIONS.map(({ value, label }) => ({ value, label })),
        help: "Update → /updates/…, Success Story → /stories/…, Active Project → /projects/…",
      },
      { name: "slug", label: "Web address", type: "slug", from: "title", prefix: "…/", required: true, maxLength: 200, half: true },
      { name: "card_title", label: "Card title", type: "text", maxLength: 255, help: "A shorter heading for the list-page card. Leave empty to use the title." },
      {
        name: "excerpt",
        label: "Card summary",
        type: "textarea",
        rows: 3,
        maxLength: 400,
        required: true,
        help: "One or two sentences. Shown on the list cards and to search engines.",
      },
      { name: "image_media_id", label: "Main image", type: "media", required: true, help: "Used on the card, at the top of the article and when shared." },
      { name: "published_at", label: "Publish date", type: "datetime", required: true, half: true, help: "Orders the lists. A future date keeps the post hidden until then." },
      { name: "date_label", label: "Date shown", type: "text", maxLength: 80, half: true, placeholder: "Active Since May 2025", help: "Optional wording in place of the date, e.g. “Ongoing”." },
      { name: "location", label: "Location", type: "text", maxLength: 200, half: true, placeholder: "Chitral, Pakistan" },
      { name: "author_id", label: "Author", type: "select", optionsFrom: "authors", allowEmpty: "No author", half: true },
      { name: "body", label: "Body", type: "richtext" },
      {
        name: "categories",
        label: "Topics",
        type: "relation",
        optionsFrom: "categories",
        join: { table: "post_categories", ownKey: "post_id", otherKey: "category_id" },
        help: "The first one is shown as the post's label.",
      },
      { name: "featured", label: "Feature at the top of its list", type: "toggle" },
      { name: "cta_heading", label: "Closing band — heading", type: "text", maxLength: 200, help: "The green band at the foot of the article. Leave empty for the standard one." },
      { name: "cta_text", label: "Closing band — supporting line", type: "textarea", rows: 2, maxLength: 400 },
      { name: "cta_primary_label", label: "Main button label", type: "text", maxLength: 80, half: true, placeholder: "Support our work" },
      { name: "cta_primary_url", label: "Main button link", type: "text", maxLength: 500, half: true, placeholder: "/donate" },
      { name: "cta_secondary_label", label: "Second button label", type: "text", maxLength: 80, half: true },
      { name: "cta_secondary_url", label: "Second button link", type: "text", maxLength: 500, half: true, placeholder: "/updates" },
      { name: "seo_title", label: "Search title", type: "text", maxLength: 200, help: "Leave empty to use the title. Under 60 characters reads best." },
      { name: "seo_description", label: "Search description", type: "textarea", rows: 2, maxLength: 400, help: "Leave empty to use the card summary." },
    ],
    publicPath: (row) => postPath(row.section, row.slug),
    newDefaults: { section: "update" },
    slugScope: "section",
    mediaColumns: ["image_media_id"],
    richColumns: ["body"],
  },
  {
    key: "categories",
    table: "categories",
    label: "Topic",
    plural: "Topics",
    group: "Stories",
    description: "Topics posts are filed under. Each has its own page and a filter chip on the list pages.",
    titleField: "title",
    searchFields: ["title", "slug", "description"],
    columns: [{ field: "slug", label: "Address", kind: "muted" }],
    defaultSort: "order",
    fields: [
      { name: "title", label: "Name", type: "text", required: true, maxLength: 160 },
      { name: "slug", label: "Web address", type: "slug", from: "title", prefix: "/topics/", required: true, maxLength: 160 },
      { name: "description", label: "Description", type: "textarea", rows: 2, maxLength: 400, help: "One sentence, shown on the topic's page." },
      { name: "seo_title", label: "Search title", type: "text", maxLength: 200, help: "Leave empty to use the name." },
      { name: "seo_description", label: "Search description", type: "textarea", rows: 2, maxLength: 400, help: "Leave empty to use the description." },
    ],
    publicPath: (row) => (row.slug ? `/topics/${row.slug}` : null),
    newDefaults: { status: "published" },
    mediaColumns: [],
  },
  {
    key: "authors",
    table: "authors",
    label: "Author",
    plural: "Authors",
    group: "Stories",
    description: "Who wrote a post, shown in its byline.",
    titleField: "name",
    thumbField: "image_media_id",
    searchFields: ["name", "role"],
    columns: [{ field: "role", label: "Role", kind: "muted" }],
    defaultSort: "order",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, maxLength: 160, half: true },
      { name: "role", label: "Role", type: "text", maxLength: 160, half: true },
      { name: "bio", label: "Short biography", type: "textarea", rows: 3, maxLength: 2000 },
      { name: "image_media_id", label: "Photograph", type: "media" },
    ],
    newDefaults: { status: "published" },
    mediaColumns: ["image_media_id"],
  },
  {
    key: "testimonials",
    table: "testimonials",
    label: "Testimonial",
    plural: "Testimonials",
    group: "Stories",
    description: "“The difference your support makes” on the home page, in the words of the people WEF works with.",
    titleField: "quote",
    thumbField: "image_media_id",
    searchFields: ["quote", "name", "context"],
    columns: [{ field: "name", label: "Said by", kind: "muted" }],
    defaultSort: "order",
    fields: [
      { name: "quote", label: "Quote", type: "textarea", rows: 4, required: true, maxLength: 1000, help: "Word for word, without the quotation marks — the site adds them." },
      { name: "name", label: "Who said it", type: "text", maxLength: 160, half: true, placeholder: "Parent of Yawar" },
      { name: "context", label: "Their role or program", type: "text", maxLength: 200, half: true, placeholder: "ECD Learning Center" },
      { name: "location", label: "Where", type: "text", maxLength: 160, half: true, placeholder: "Chitral, Pakistan" },
      { name: "image_media_id", label: "Photograph (optional)", type: "media", half: true },
      { name: "post_id", label: "Links to the full story", type: "select", optionsFrom: "posts", allowEmpty: "No link" },
    ],
    publicPath: () => "/",
    mediaColumns: ["image_media_id"],
  },
  {
    key: "programs",
    table: "programs",
    label: "Program card",
    plural: "Program Cards",
    group: "Programs",
    description: "The program cards on Home (photo strip and Our Programs) and on the Mission page. Each card belongs to one of those places; filter by place to reorder them.",
    titleField: "title",
    thumbField: "image_media_id",
    searchFields: ["title", "lead", "category"],
    columns: [
      { field: "placement", label: "Shows on", kind: "badge" },
      { field: "badge", label: "Badge", kind: "muted" },
    ],
    filters: [{ field: "placement", label: "Shows on", options: PROGRAM_PLACEMENTS }],
    defaultSort: "order",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, maxLength: 255 },
      { name: "placement", label: "Shows on", type: "select", required: true, half: true, options: PROGRAM_PLACEMENTS },
      { name: "badge", label: "Badge", type: "text", maxLength: 80, half: true, placeholder: "Launched 2025", help: "Home programs and Mission only." },
      { name: "lead", label: "Introduction", type: "textarea", rows: 3, maxLength: 1000, help: "On the photo strip this is the one line under the title." },
      { name: "image_media_id", label: "Photograph", type: "media", required: true },
      { name: "points", label: "Key points", type: "lines", rows: 4, maxLength: 2000, help: "Home programs only. One per line, shown with a tick." },
      { name: "stats", label: "Figures", type: "lines", rows: 3, maxLength: 1000, help: "Home programs only. One per line as “number | label”, e.g. “100 | centers today”." },
      { name: "category", label: "Category label", type: "text", maxLength: 80, half: true, help: "Mission only, e.g. “Early Childhood”." },
      { name: "accent", label: "Accent colour", type: "text", maxLength: 20, half: true, placeholder: "#3C762E", help: "Mission only. A hex colour." },
      {
        name: "columns_text",
        label: "Columns",
        type: "textarea",
        rows: 8,
        maxLength: 4000,
        help: "Mission only. Blocks separated by an empty line; each block is a heading (Where, Who, Impact…) and then one item per line.",
      },
      { name: "notes", label: "Notes", type: "lines", rows: 3, maxLength: 2000, help: "Mission only. One per line; a line starting “Projected investment” or “Total investment” is highlighted." },
      {
        name: "parent_id",
        label: "Part of",
        type: "select",
        optionsFrom: "programs",
        allowEmpty: "Nothing — a card of its own",
        help: "Mission only. Makes this card an expandable track inside another card (as the two scholarship tracks are). Its badge becomes the line beside its title.",
      },
      { name: "post_id", label: "Links to", type: "select", optionsFrom: "posts", allowEmpty: "No link", help: "Optional. Makes the card open a project page or update." },
    ],
    publicPath: (row) => (row.placement === "mission" ? "/mission" : "/"),
    mediaColumns: ["image_media_id"],
  },
  {
    key: "stats",
    table: "stats",
    label: "Figure",
    plural: "Figures",
    group: "Programs",
    description: "The counters on the home page, the “at a glance” figures on the Mission page and the figures on the Donate page.",
    titleField: "label",
    searchFields: ["value", "label", "note"],
    columns: [
      { field: "value", label: "Number" },
      { field: "placement", label: "Shows on", kind: "muted" },
    ],
    filters: [{ field: "placement", label: "Shows on", options: STAT_PLACEMENTS }],
    defaultSort: "order",
    fields: [
      { name: "value", label: "Number", type: "text", required: true, maxLength: 40, half: true, help: 'As it should read, e.g. "100" or "3,000+".' },
      { name: "label", label: "What is counted", type: "text", required: true, maxLength: 160, half: true },
      { name: "note", label: "Small print", type: "text", maxLength: 200, help: "Home counters only, e.g. “women-led, in Chitral”." },
      { name: "placement", label: "Shows on", type: "select", required: true, half: true, options: STAT_PLACEMENTS },
      { name: "as_of", label: "True as of", type: "date", half: true, help: "For your records." },
    ],
    publicPath: (row) => (row.placement === "mission" ? "/mission" : row.placement === "donate" ? "/donate" : "/"),
    mediaColumns: [],
  },
  {
    key: "learning-centers",
    table: "learning_centers",
    label: "Learning center",
    plural: "Learning Centers",
    group: "Programs",
    description: "Every center on the Learning Centers map. A center without coordinates is listed but not pinned.",
    titleField: "village",
    searchFields: ["name", "village", "sponsor", "region", "model"],
    columns: [
      { field: "name", label: "Run by", kind: "muted" },
      { field: "region", label: "Region", kind: "muted" },
      { field: "sponsor", label: "Sponsor", kind: "muted" },
    ],
    defaultSort: "order",
    fields: [
      { name: "village", label: "Village or school", type: "text", required: true, maxLength: 160, half: true },
      { name: "name", label: "Run by", type: "text", maxLength: 160, half: true, help: "The teacher who runs the center." },
      { name: "region", label: "Region", type: "text", maxLength: 80, half: true, placeholder: "Lower Chitral" },
      { name: "model", label: "Model", type: "text", maxLength: 80, half: true, placeholder: "Entrepreneurial Model" },
      { name: "sponsor", label: "Sponsor", type: "text", maxLength: 255, help: "The funding partner, used by the map's sponsor filter." },
      { name: "enrollment", label: "Children enrolled", type: "number", half: true },
      { name: "lat", label: "Latitude", type: "number", half: true },
      { name: "lon", label: "Longitude", type: "number", half: true },
    ],
    publicPath: () => "/centers",
    mediaColumns: [],
  },
  {
    key: "hero-slides",
    table: "hero_slides",
    label: "Slide",
    plural: "Home Slideshow",
    group: "Website",
    description: "The photographs at the top of the home page, in order.",
    titleField: "description",
    thumbField: "image_media_id",
    searchFields: ["description"],
    columns: [],
    defaultSort: "order",
    fields: [
      { name: "image_media_id", label: "Photograph", type: "media", required: true, help: "Landscape, at least 1600px wide." },
      { name: "description", label: "Caption", type: "text", required: true, maxLength: 300 },
    ],
    publicPath: () => "/",
    mediaColumns: ["image_media_id"],
  },
  {
    key: "faqs",
    table: "faqs",
    label: "Question",
    plural: "Donation FAQs",
    group: "Website",
    description: "“Before you give” on the Donate page.",
    titleField: "question",
    searchFields: ["question"],
    columns: [],
    defaultSort: "order",
    fields: [
      { name: "question", label: "Question", type: "text", required: true, maxLength: 300 },
      { name: "answer", label: "Answer", type: "richtext", required: true },
    ],
    publicPath: () => "/donate",
    mediaColumns: [],
    richColumns: ["answer"],
  },
  {
    key: "team",
    table: "team_members",
    label: "Team member",
    plural: "Team",
    group: "People",
    description: "Everyone on the Our Team page, grouped under Team Groups.",
    titleField: "name",
    thumbField: "image_media_id",
    searchFields: ["name", "role", "bio"],
    columns: [
      { field: "role", label: "Role", kind: "muted" },
      { field: "group_heading", label: "Group" },
    ],
    filters: [{ field: "group_id", label: "Group", optionsFrom: "team_groups" }],
    defaultSort: "order",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, maxLength: 160, half: true },
      { name: "role", label: "Role", type: "text", maxLength: 160, half: true },
      { name: "group_id", label: "Group", type: "select", optionsFrom: "team_groups", required: true, half: true },
      { name: "linkedin_url", label: "LinkedIn", type: "url", half: true },
      { name: "image_media_id", label: "Photograph", type: "media", help: "A head-and-shoulders photo, at least 600px wide." },
      { name: "bio", label: "Biography", type: "textarea", rows: 5, maxLength: 4000, help: "Opens in “Read bio”. Leave a blank line between paragraphs." },
    ],
    publicPath: () => "/team",
    mediaColumns: ["image_media_id"],
  },
  {
    key: "team-groups",
    table: "team_groups",
    label: "Team group",
    plural: "Team Groups",
    group: "People",
    description: "The headings people are grouped under on the Our Team page.",
    titleField: "heading",
    searchFields: ["heading"],
    columns: [],
    defaultSort: "order",
    fields: [
      { name: "heading", label: "Heading", type: "text", required: true, maxLength: 160 },
      { name: "eyebrow", label: "Small heading above it", type: "text", maxLength: 120, placeholder: "Guidance & governance" },
      { name: "description", label: "Line under the heading", type: "textarea", rows: 2, maxLength: 500 },
    ],
    publicPath: () => "/team",
    newDefaults: { status: "published" },
    mediaColumns: [],
  },
  {
    key: "gallery",
    table: "gallery_items",
    label: "Photo",
    plural: "Gallery",
    group: "Media",
    description: "The Gallery page. Each photo sits under one gallery category.",
    titleField: "caption",
    thumbField: "media_id",
    searchFields: ["caption"],
    columns: [{ field: "category_label", label: "Category", kind: "muted" }],
    filters: [{ field: "category_id", label: "Category", optionsFrom: "gallery_categories" }],
    defaultSort: "order",
    fields: [
      { name: "media_id", label: "Photograph", type: "media", required: true, help: "Its description (alt text) is edited in the Media Library." },
      { name: "caption", label: "Title", type: "text", maxLength: 300, help: "Shown over the photo and in the lightbox." },
      { name: "category_id", label: "Category", type: "select", optionsFrom: "gallery_categories", allowEmpty: "No category" },
    ],
    publicPath: () => "/gallery",
    mediaColumns: ["media_id"],
  },
  {
    key: "gallery-categories",
    table: "gallery_categories",
    label: "Gallery category",
    plural: "Gallery Categories",
    group: "Media",
    description: "The filter chips on the Gallery page.",
    titleField: "label",
    searchFields: ["label"],
    columns: [],
    defaultSort: "order",
    fields: [{ name: "label", label: "Name", type: "text", required: true, maxLength: 80 }],
    publicPath: () => "/gallery",
    newDefaults: { status: "published" },
    mediaColumns: [],
  },
];

export function getResource(key: string): ResourceDef | null {
  return RESOURCES.find((r) => r.key === key) ?? null;
}

/** Extra joined columns some lists show (a member's group, a photo's category). */
export const LIST_JOINS: Record<string, { select: string; join: string }> = {
  team_members: {
    select: "tg.heading AS group_heading",
    join: "LEFT JOIN team_groups tg ON tg.id = t.group_id",
  },
  gallery_items: {
    select: "gc.label AS category_label",
    join: "LEFT JOIN gallery_categories gc ON gc.id = t.category_id",
  },
};
