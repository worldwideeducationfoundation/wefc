import Link from "next/link";

/**
 * Shown above a draft when a signed-in admin previews it. Visitors can never
 * reach a draft, so they never see this.
 */
export function PreviewBanner({ editHref, label = "Draft preview" }: { editHref: string; label?: string }) {
  return (
    <div className="wef-preview">
      <strong>{label}.</strong> Only signed-in admins can see this page until it is published. <Link href={editHref}>Back to the editor</Link>
    </div>
  );
}
