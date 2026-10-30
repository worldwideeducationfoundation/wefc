import Link from "next/link";
import type { PostCard } from "@/lib/types";
import { ArrowRight } from "./Icons";

/** One card on the list and topic pages: the old site's `.ap-card`. */
export function PostCardView({ post, readMore }: { post: PostCard; readMore: string }) {
  return (
    <Link className="ap-card" href={post.href} data-categories={post.categories.map((c) => c.slug).join(" ")}>
      <div className="ap-card-media">
        {post.image && (
          // eslint-disable-next-line @next/next/no-img-element -- stored as WebP; the card's CSS crops it
          <img src={post.image.src} width={post.image.width} height={post.image.height} alt={post.image.alt} loading="lazy" decoding="async" />
        )}
      </div>
      <div className="ap-card-body">
        <h3>{post.cardTitle}</h3>
        <p>{post.excerpt}</p>
        <span className="ap-card-link">
          {readMore} <ArrowRight />
        </span>
      </div>
    </Link>
  );
}

export function PostCardGrid({ posts, readMore }: { posts: PostCard[]; readMore: string }) {
  return (
    <div className="ap-grid">
      {posts.map((p) => (
        <PostCardView key={p.id} post={p} readMore={readMore} />
      ))}
    </div>
  );
}
