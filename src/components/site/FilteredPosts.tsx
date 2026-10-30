"use client";

import { useEffect, useState } from "react";
import type { CategoryRef, PostCard } from "@/lib/types";
import { PostCardView } from "./PostCards";

/**
 * A list page's topic chips and cards. Every card is server-rendered, so the
 * list works and is crawlable without JavaScript; each chip is a real link to
 * the topic's own page. With JavaScript the chips filter in place instead,
 * and the choice is mirrored into ?category= so a filtered view can be shared.
 */
export function FilteredPosts({ posts, categories, readMore }: { posts: PostCard[]; categories: CategoryRef[]; readMore: string }) {
  const [active, setActive] = useState("");

  useEffect(() => {
    const read = () => setActive(new URL(window.location.href).searchParams.get("category") ?? "");
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const select = (slug: string) => {
    const next = slug && slug === active ? "" : slug;
    setActive(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("category", next);
    else url.searchParams.delete("category");
    window.history.pushState({ category: next }, "", url);
  };

  const counts = new Map<string, number>();
  for (const p of posts) for (const c of p.categories) counts.set(c.slug, (counts.get(c.slug) ?? 0) + 1);
  const chips = categories.filter((c) => counts.get(c.slug));
  const shown = active ? posts.filter((p) => p.categories.some((c) => c.slug === active)) : posts;

  return (
    <>
      {chips.length > 0 && (
        <nav className="ap-filters" aria-label="Filter by topic">
          <a
            className="ap-filter"
            href="?"
            aria-current={!active ? "true" : undefined}
            onClick={(e) => {
              e.preventDefault();
              select("");
            }}
          >
            All<span className="n">{posts.length}</span>
          </a>
          {chips.map((c) => (
            <a
              key={c.slug}
              className="ap-filter"
              href={`/topics/${c.slug}`}
              aria-current={active === c.slug ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                select(c.slug);
              }}
            >
              {c.title}
              <span className="n">{counts.get(c.slug)}</span>
            </a>
          ))}
        </nav>
      )}
      {shown.length ? (
        <div className="ap-grid">
          {shown.map((p) => (
            <PostCardView key={p.id} post={p} readMore={readMore} />
          ))}
        </div>
      ) : (
        <p className="ap-empty">Nothing here yet under this topic.</p>
      )}
    </>
  );
}
