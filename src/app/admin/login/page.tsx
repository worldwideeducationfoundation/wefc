import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/admin/AuthFrame";
import { LoginForm } from "@/components/admin/AuthForms";
import { Alert } from "@/components/admin/ui";
import { adminCount, getCurrentUser } from "@/server/auth/session";
import { DatabaseNotConfiguredError, SchemaSetupError } from "@/server/db";

export const metadata: Metadata = { title: "Sign in" };

const REASONS: Record<string, string> = {
  signedOut: "You have been signed out.",
};

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const params = await searchParams;
  let problem: string | null = null;
  try {
    if (await getCurrentUser()) redirect("/admin");
    if ((await adminCount()) === 0) redirect("/admin/setup");
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError || err instanceof SchemaSetupError) problem = err.message;
    else if (err && typeof err === "object" && "code" in err) {
      problem = `The database could not be reached (${String((err as { code: unknown }).code)}). Check DB_HOST, DB_USER, DB_PASSWORD and DB_NAME.`;
    } else throw err;
  }

  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <AuthFrame title="Sign in" intro="Manage the Worldwide Education Fund Canada website.">
      {problem ? (
        <Alert tone="error">{problem}</Alert>
      ) : (
        <>
          {params.signedOut && (
            <div className="mb-4">
              <Alert tone="success">{REASONS.signedOut}</Alert>
            </div>
          )}
          <LoginForm next={next} />
          <p className="mt-6 text-center text-[13px] text-ink-muted">
            Forgotten your password? Ask another administrator to set a new one under Users.
          </p>
        </>
      )}
      <p className="mt-4 text-center text-[13px]">
        <Link href="/" className="font-semibold text-forest-900 underline underline-offset-4">
          ← Back to the website
        </Link>
      </p>
    </AuthFrame>
  );
}
