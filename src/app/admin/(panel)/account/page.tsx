import type { Metadata } from "next";
import { AccountForm } from "@/components/admin/UserForms";
import { PageHeader } from "@/components/admin/ui";
import { ROLE_LABELS } from "@/server/auth/roles";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Your account" description={`Signed in as ${user.email} · ${ROLE_LABELS[user.role]}`} />
      <AccountForm initial={{ name: user.name, email: user.email }} />
    </>
  );
}
