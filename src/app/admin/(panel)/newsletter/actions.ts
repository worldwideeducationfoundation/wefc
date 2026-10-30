"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/server/activity";
import { requireCapability } from "@/server/auth/session";
import { execute, queryOne } from "@/server/db";

export async function setSubscriberStatus(id: number, status: "subscribed" | "unsubscribed") {
  const user = await requireCapability("submissions.manage");
  const row = await queryOne<{ email: string }>("SELECT email FROM newsletter_subscribers WHERE id = ?", [id]);
  await execute("UPDATE newsletter_subscribers SET status = ? WHERE id = ?", [status === "subscribed" ? "subscribed" : "unsubscribed", id]);
  await logActivity(user.id, status === "subscribed" ? "resubscribe" : "unsubscribe", "newsletter", row?.email ?? `#${id}`);
  redirect("/admin/newsletter?notice=saved");
}

/** Removes an address entirely — for someone who asks to have their details deleted. */
export async function deleteSubscriber(id: number) {
  const user = await requireCapability("submissions.manage");
  const row = await queryOne<{ email: string }>("SELECT email FROM newsletter_subscribers WHERE id = ?", [id]);
  await execute("DELETE FROM newsletter_subscribers WHERE id = ?", [id]);
  await logActivity(user.id, "delete", "newsletter", row?.email ?? `#${id}`);
  redirect("/admin/newsletter?notice=deleted");
}
