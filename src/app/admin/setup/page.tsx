import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/admin/AuthFrame";
import { SetupForm } from "@/components/admin/AuthForms";
import { adminCount } from "@/server/auth/session";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Set up" };

/**
 * First run: creates the first admin account, protected by ADMIN_SETUP_KEY.
 * Once any account exists this page only redirects. A new, empty copy of the
 * site gets its content from Admin -> Backups -> Restore.
 */
export default async function SetupPage() {
  if ((await adminCount()) > 0) redirect("/admin/login");

  return (
    <AuthFrame
      title="Welcome — let’s set up the admin"
      intro="Create the first administrator account. You can add more people later under Users."
    >
      <SetupForm keyConfigured={Boolean(env.setupKey)} />
    </AuthFrame>
  );
}
