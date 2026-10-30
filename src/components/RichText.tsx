import Link from "next/link";
import type { ReactNode } from "react";
import { type RichDoc, type RichMark, type RichNode, safeHref, youtubeId } from "@/lib/richtext";
import type { MediaRef } from "@/lib/types";

/**
 * RichText — a document from the admin's editor, rendered as plain semantic
 * HTML. The surrounding page styles it (the article page's `.proj-article`,
 * the FAQ's `dd`), exactly as the old site's hand-written HTML was styled.
 *
 * Every node type the editor can produce has a renderer here; anything else
 * is dropped rather than shown unstyled. There is no h1: the page title is
 * the only one, so a level-1 heading typed in the editor becomes an h2.
 *
 * Images refer to the media library by id; `media` maps each id to the file
 * so the page always shows the current file and its current alt text.
 */

type Ctx = { media: Record<number, MediaRef> };

function applyMarks(text: ReactNode, marks: RichMark[] | undefined, key: string): ReactNode {
  let out = text;
  for (const mark of marks ?? []) {
    if (mark.type === "bold") out = <strong>{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else if (mark.type === "underline") out = <u>{out}</u>;
    else if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      if (!href) continue;
      out = /^https?:/.test(href) ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {out}
        </a>
      ) : href.startsWith("/") && !href.startsWith("/uploads/") ? (
        <Link href={href}>{out}</Link>
      ) : (
        <a href={href}>{out}</a>
      );
    }
  }
  return <span key={key}>{out}</span>;
}

function inline(nodes: RichNode[] | undefined, keyPrefix: string): ReactNode[] {
  return (nodes ?? []).map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    if (node.type === "text") return applyMarks(node.text ?? "", node.marks, key);
    if (node.type === "hardBreak") return <br key={key} />;
    return null;
  });
}

function block(node: RichNode, key: string, ctx: Ctx): ReactNode {
  switch (node.type) {
    case "paragraph":
      return node.content?.length ? <p key={key}>{inline(node.content, key)}</p> : null;
    case "heading":
      return Number(node.attrs?.level) >= 3 ? (
        <h3 key={key}>{inline(node.content, key)}</h3>
      ) : (
        <h2 key={key}>{inline(node.content, key)}</h2>
      );
    case "bulletList":
    case "orderedList": {
      const Tag = node.type === "bulletList" ? "ul" : "ol";
      return (
        <Tag key={key}>
          {(node.content ?? []).map((item, i) => (
            <li key={`${key}-${i}`}>
              {(item.content ?? []).map((child, j) =>
                child.type === "paragraph" ? (
                  <span key={`${key}-${i}-${j}`}>{inline(child.content, `${key}-${i}-${j}`)}</span>
                ) : (
                  block(child, `${key}-${i}-${j}`, ctx)
                ),
              )}
            </li>
          ))}
        </Tag>
      );
    }
    case "blockquote":
      return (
        <blockquote key={key}>
          {(node.content ?? []).map((child, i) =>
            child.type === "paragraph" ? <p key={`${key}-${i}`}>{inline(child.content, `${key}-${i}`)}</p> : block(child, `${key}-${i}`, ctx),
          )}
        </blockquote>
      );
    case "horizontalRule":
      return <hr key={key} />;
    case "figure": {
      const media = ctx.media[Number(node.attrs?.mediaId)];
      if (!media) return null;
      const alt = String(node.attrs?.alt ?? "") || media.alt;
      const caption = String(node.attrs?.caption ?? "") || null;
      return (
        <figure key={key}>
          {/* eslint-disable-next-line @next/next/no-img-element -- stored as WebP at most 2400px; the article CSS sizes it */}
          <img src={media.src} width={media.width} height={media.height} alt={alt} loading="lazy" decoding="async" />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    }
    case "statStrip": {
      const stats = Array.isArray(node.attrs?.stats) ? (node.attrs.stats as { value?: string; label?: string }[]) : [];
      if (!stats.length) return null;
      return (
        <div key={key} className="proj-stats">
          {stats.map((s, i) => (
            <div key={i}>
              <span className="n">{s.value}</span>
              <span className="l">{s.label}</span>
            </div>
          ))}
        </div>
      );
    }
    case "pullQuote":
      if (!node.attrs?.quote) return null;
      return (
        <blockquote key={key}>
          <p>{String(node.attrs.quote)}</p>
          {node.attrs.attribution ? <p>— {String(node.attrs.attribution)}</p> : null}
        </blockquote>
      );
    case "video": {
      const id = youtubeId(String(node.attrs?.url ?? ""));
      if (!id) return null;
      return (
        <figure key={key} style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title="Video"
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: 0, borderRadius: 16 }}
          />
        </figure>
      );
    }
    default:
      return null;
  }
}

export function RichText({ doc, media = {} }: { doc: RichDoc | null | undefined; media?: Record<number, MediaRef> }) {
  if (!doc?.content?.length) return null;
  return <>{doc.content.map((node, i) => block(node, `n${i}`, { media }))}</>;
}
