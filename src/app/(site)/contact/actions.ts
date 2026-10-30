"use server";

import { z } from "zod";
import { invalidateContent } from "@/server/cache";
import { execute, queryOne } from "@/server/db";
import { clientIp, userAgent } from "@/server/request";
import { addSubscriber } from "@/server/newsletter";

export type ContactState = {
  status: "idle" | "sent" | "error";
  message?: string;
  errors?: Partial<Record<"name" | "email" | "phone" | "topic" | "message", string>>;
  values?: Record<string, string>;
};

const schema = z.object({
  name: z.string().trim().min(1, "Please tell us your name.").max(160, "That name is too long."),
  email: z.string().trim().email("Please enter a valid email address so we can reply.").max(190),
  phone: z.string().trim().max(60, "That phone number is too long.").optional(),
  topic: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, "Please write a message.").max(5000, "Please keep your message under 5,000 characters."),
});

/** Messages from one address in the last hour before it is asked to wait. */
const PER_IP_PER_HOUR = 5;
/** All messages in the last hour: a ceiling a bot rotating addresses cannot pass. */
const SITE_PER_HOUR = 60;

/**
 * The public contact form. Every message is stored in Admin -> Messages, so
 * nothing depends on email delivery working. A hidden field people never see
 * catches most bots; a per-address limit catches the rest. Ticking "Keep me
 * updated" also adds the address to the newsletter list.
 */
export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    topic: String(formData.get("topic") ?? ""),
    message: String(formData.get("message") ?? ""),
    subscribe: formData.get("subscribe") ? "1" : "",
  };

  // Honeypot: pretend it worked, store nothing.
  if (String(formData.get("wef_hp") ?? "").trim() !== "") return { status: "sent" };

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const errors: ContactState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<ContactState["errors"]>;
      errors[key] ??= issue.message;
    }
    return { status: "error", message: "Please check the highlighted fields.", errors, values };
  }

  const ip = await clientIp();
  try {
    const recent = await queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM submissions WHERE ip_address = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR",
      [ip],
    );
    const everyone = await queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM submissions WHERE created_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR",
    );
    if (Number(recent?.n ?? 0) >= PER_IP_PER_HOUR || Number(everyone?.n ?? 0) >= SITE_PER_HOUR) {
      return {
        status: "error",
        message: "You have sent several messages in the last hour. Please wait a little, or email us directly.",
        values,
      };
    }

    const d = parsed.data;
    const ua = await userAgent();
    await execute(
      `INSERT INTO submissions (form_type, name, email, phone, subject, message, ip_address, user_agent)
       VALUES ('contact', ?, ?, ?, ?, ?, ?, ?)`,
      [d.name, d.email.toLowerCase(), d.phone || null, d.topic || null, d.message, ip, ua],
    );
    if (values.subscribe) await addSubscriber(d.email.toLowerCase(), d.name, "contact form", ip, ua);
    invalidateContent();
  } catch (err) {
    console.error("[contact] could not store message", err);
    return {
      status: "error",
      message: "Sorry — your message could not be sent just now. Please try again, or email us directly.",
      values,
    };
  }

  return { status: "sent" };
}
