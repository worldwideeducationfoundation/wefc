/**
 * JSON-LD, rendered server-side.
 *
 * A plain <script> in a Server Component, not next/script: structured
 * data has to be in the HTML a crawler receives, and this ships no
 * client JavaScript at all.
 *
 * `<` is escaped because a "</script>" appearing inside string content
 * would otherwise close the tag early. JSON.stringify does not do this.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
