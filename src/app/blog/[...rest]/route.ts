/**
 * Everything else that was under the WordPress /blog/ section was theme filler
 * and is intentionally gone. 410 tells search engines so, which drops it from
 * the index faster than a 404. The real posts redirect (next.config.ts).
 */
const gone = () => new Response("Gone", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
export const GET = gone;
export const HEAD = gone;
