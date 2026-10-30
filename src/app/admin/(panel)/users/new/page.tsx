import type { Metadata } from "next";
import { UserForm } from "@/components/admin/UserForms";
import { PageHeader } from "@/components/admin/ui";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@/server/auth/roles";
import { requireCapability } from "@/server/auth/session";
import { saveUser } from "../actions";

export const metadata: Metadata = { title: "Add a person" };

export default async function NewUserPage() {
  await requireCapability("users.manage");
  return (
    <>
      <PageHeader title="Add a person" back={{ href: "/admin/users", label: "Users & Roles" }} />
      <UserForm
        initial={{ name: "", email: "", role: "editor", status: "active" }}
        roles={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r], description: ROLE_DESCRIPTIONS[r] }))}
        isNew
        isSelf={false}
        action={saveUser.bind(null, null)}
      />
    </>
  );
}
