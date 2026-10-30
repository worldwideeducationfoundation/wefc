import "server-only";
import { headers } from "next/headers";

/**
 * The visitor's IP address, for rate limits and the activity log.
 *
 * Hostinger puts a proxy in front of the app. X-Real-IP is set by that proxy
 * and preferred; X-Forwarded-For's first entry is a fallback, but a client
 * can write anything there, so no limit relies on the IP alone — the public
 * forms also have a site-wide cap (see contact and newsletter actions).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (real || forwarded || "0.0.0.0").slice(0, 45);
}

export async function userAgent(): Promise<string> {
  return ((await headers()).get("user-agent") ?? "").slice(0, 255);
}

/** True when the browser connection was HTTPS, including behind a proxy. */
export async function requestIsHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return process.env.NODE_ENV === "production";
}
