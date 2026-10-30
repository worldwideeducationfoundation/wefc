"use server";

import { z } from "zod";
import { queryOne } from "@/server/db";
import { addSubscriber } from "@/server/newsletter";
import { clientIp, userAgent } from "@/server/request";

export type NewsletterState = { status: "idle" | "done" | "error"; message?: string; values?: { name: string; email: string } };

const emailSchema = z.string().trim().toLowerCase().email().max(190);

/** Signups from one address in an hour, and from everyone in an hour. */
const PER_IP_PER_HOUR = 5;
const SITE_PER_HOUR = 300;

/**
 * The home page's newsletter signup. Every address is stored in the database
 * (Admin -> Newsletter). The reply is the same whether or not the address was
 * already on the list, so the form cannot be used to find out who subscribes.
 */
export async function subscribeNewsletter(_prev: NewsletterState, form: FormData): Promise<NewsletterState> {
  // Hidden field people never see; bots fill it in.
  if (String(form.get("wef_hp") ?? "").trim()) return { status: "done" };

  const values = { name: String(form.get("name") ?? "").trim().slice(0, 200), email: String(form.get("email") ?? "") };
  const parsed = emailSchema.safeParse(values.email);
  if (!parsed.success) return { status: "error", message: "Please enter a valid email address.", values };

  try {
    const ip = await clientIp();
    const [mine, all] = await Promise.all([
      queryOne<{ n: number }>(
        "SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE ip_address = ? AND updated_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR",
        [ip],
      ),
      queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE updated_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR"),
    ]);
    if (Number(mine?.n ?? 0) >= PER_IP_PER_HOUR || Number(all?.n ?? 0) >= SITE_PER_HOUR) {
      return { status: "error", message: "Too many signups just now. Please try again later.", values };
    }
    await addSubscriber(parsed.data, values.name || null, "homepage", ip, await userAgent());
  } catch (err) {
    console.error("[newsletter] could not store signup", err);
    return { status: "error", message: "Sorry — that did not work. Please try again.", values };
  }
  return { status: "done" };
}
