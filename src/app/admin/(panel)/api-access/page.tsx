import type { Metadata } from "next";
import { ApiKeyForm } from "@/components/admin/ApiKeyForm";
import { ConfirmButton } from "@/components/admin/client";
import { Badge, Card, EmptyState, PageHeader, btn, formatDateTime } from "@/components/admin/ui";
import { absoluteUrl } from "@/lib/site-url";
import { ROLE_LABELS, type Role } from "@/server/auth/roles";
import { requireUser } from "@/server/auth/session";
import { query } from "@/server/db";
import { revokeToken } from "./actions";

export const metadata: Metadata = { title: "API Access" };

/**
 * Keys for the Content API, which lets Claude (or any tool) add and update
 * posts, projects, team members, testimonials, page texts and images without
 * the admin forms. A key acts as the person who made it, with their role.
 */
export default async function ApiAccessPage() {
  const user = await requireUser();
  const all = user.role === "super_admin";
  const keys = await query<{
    id: number;
    name: string;
    token_hint: string;
    created_at: Date;
    last_used_at: Date | null;
    revoked_at: Date | null;
    owner: string;
    owner_role: Role;
  }>(
    `SELECT t.id, t.name, t.token_hint, t.created_at, t.last_used_at, t.revoked_at, u.name AS owner, u.role AS owner_role
       FROM api_tokens t JOIN admin_users u ON u.id = t.user_id
      ${all ? "" : "WHERE t.user_id = ?"} ORDER BY t.revoked_at IS NULL DESC, t.created_at DESC`,
    all ? [] : [user.id],
  );

  return (
    <>
      <PageHeader
        title="API Access"
        description="Keys that let Claude — or any other tool — add and update the website's content directly: posts, projects, team, testimonials, page texts and images. Everything done with a key appears in the Activity Log, marked “(API)”."
      />
      <div className="grid max-w-4xl gap-5">
        <Card title="Create a key" description={`A key can do exactly what your account can (${ROLE_LABELS[user.role]}). Treat it like a password.`}>
          <ApiKeyForm />
        </Card>

        <Card title={all ? "All keys" : "Your keys"}>
          {keys.length === 0 ? (
            <EmptyState title="No keys yet" />
          ) : (
            <ul className="divide-y divide-sand-200">
              {keys.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-forest-900">
                      {k.name} <code className="ml-1 text-[12px] font-normal text-ink-muted">{k.token_hint}…</code>
                    </p>
                    <p className="text-[12px] text-ink-muted">
                      {all && <>{k.owner} ({ROLE_LABELS[k.owner_role]}) · </>}
                      created {formatDateTime(k.created_at)} · {k.last_used_at ? `last used ${formatDateTime(k.last_used_at)}` : "never used"}
                    </p>
                  </div>
                  {k.revoked_at ? (
                    <Badge value="disabled" label="Revoked" />
                  ) : (
                    <form action={revokeToken.bind(null, k.id)}>
                      <ConfirmButton className={btn.danger} message={`Revoke “${k.name}”? Anything using it stops working at once.`}>
                        Revoke
                      </ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Using it with Claude">
          <div className="space-y-3 text-[14px] text-ink">
            <p>
              Give Claude the key and the address of this API, for example by putting them in the website project’s{" "}
              <code>.env.local</code>:
            </p>
            <pre className="overflow-x-auto rounded-md bg-forest-950 p-3 text-[13px] text-sand-100">
              {`WEFC_API_URL=${absoluteUrl("/api/v1")}\nWEFC_API_TOKEN=wefc_…`}
            </pre>
            <p>
              Then ask in plain words — “publish this as a project update”, “add Ayesha to the ECD team with this photo”,
              “change the home page intro”. The full reference is <code>CONTENT_API.md</code> in the repository. New items
              are saved as drafts unless you ask for them to be published.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
