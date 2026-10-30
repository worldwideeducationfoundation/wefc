import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { PageHeader } from "@/components/admin/ui";
import { requireCapability } from "@/server/auth/session";
import { query } from "@/server/db";
import { SETTING_FIELDS } from "@/server/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireCapability("settings.manage");
  const rows = await query<{ setting_key: string; value: string | null }>("SELECT setting_key, value FROM settings");
  const values = Object.fromEntries(rows.map((r) => [r.setting_key, r.value ?? ""]));
  return (
    <>
      <PageHeader
        title="Settings"
        description="The organisation's details, shown in the footer, on the Contact page and to search engines. A field left empty uses its default."
      />
      <SettingsForm fields={SETTING_FIELDS.map((f) => ({ ...f }))} values={values} />
    </>
  );
}
