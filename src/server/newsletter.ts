import "server-only";
import { execute } from "./db";

/** Adds or re-subscribes an address. Shared with the contact form's opt-in. */
export async function addSubscriber(email: string, name: string | null, source: string, ip: string | null, ua: string | null) {
  await execute(
    `INSERT INTO newsletter_subscribers (email, name, status, source, ip_address, user_agent)
     VALUES (?, ?, 'subscribed', ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = 'subscribed', name = COALESCE(VALUES(name), name),
       ip_address = VALUES(ip_address), user_agent = VALUES(user_agent)`,
    [email, name, source, ip, ua],
  );
}
