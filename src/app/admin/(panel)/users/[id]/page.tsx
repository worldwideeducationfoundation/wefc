import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/client";
import { UserForm } from "@/components/admin/UserForms";
import { PageHeader } from "@/components/admin/ui";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/server/auth/roles";
import { requireCapability } from "@/server/auth/session";
import { queryOne } from "@/server/db";
import { deleteUser, saveUser } from "../actions";

export const metadata: Metadata = { title: "Edit person" };

export default async function EditUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const me = await requireCapability("users.manage");
  const user = await queryOne<{ name: string; email: string; role: Role; status: string }>(
    "SELECT name, email, role, status FROM admin_users WHERE id = ?",
    [id],
  );
  if (!user) notFound();
  const isSelf = id === me.id;

  return (
    <>
      <PageHeader
        title={user.name}
        back={{ href: "/admin/users", label: "Users & Roles" }}
        actions={
          !isSelf && (
            <form action={deleteUser.bind(null, id)}>
              <ConfirmButton message={`Delete ${user.name}'s account? Their past activity stays in the log.`}>Delete account</ConfirmButton>
            </form>
          )
        }
      />
      <UserForm
        initial={user}
        roles={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r], description: ROLE_DESCRIPTIONS[r] }))}
        isNew={false}
        isSelf={isSelf}
        action={saveUser.bind(null, id)}
      />
    </>
  );
}
