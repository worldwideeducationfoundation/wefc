import type { PostSection } from "./types";

/**
 * Where a post lives.
 *
 * One posts table backs three kinds, chosen per post in the admin: project
 * updates at `/updates/<slug>`, success stories at `/stories/<slug>` and
 * active projects at `/projects/<slug>`. Deriving the URL from the post
 * itself means a card links to the right place from every grid on the site.
 */
export const SECTION_PATHS: Record<PostSection, string> = {
  update: "/updates",
  story: "/stories",
  project: "/projects",
};

export const SECTION_LABELS: Record<PostSection, string> = {
  update: "Project Update",
  story: "Success Story",
  project: "Active Project",
};

export function postHref(post: { section: PostSection; slug: string }): string {
  return `${SECTION_PATHS[post.section]}/${post.slug}`;
}
