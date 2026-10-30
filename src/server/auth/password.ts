import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node, so no native module to
 * compile on the host). Stored as `scrypt$N$r$p$salt$hash`, so the cost can be
 * raised later and old hashes still verify — and are upgraded on next login.
 */
const N = 32768;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const MAXMEM = 128 * N * R * 2;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(password.normalize("NFKC"), salt, KEY_LEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/**
 * A real hash of a random password, verified against whenever the email is
 * unknown so a miss takes as long as a wrong password — otherwise timing
 * would reveal which addresses have accounts.
 */
let dummy: Promise<string> | null = null;
export function dummyHash() {
  dummy ??= hashPassword(randomBytes(18).toString("base64"));
  return dummy;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function needsRehash(stored: string) {
  const [, n, r, p] = stored.split("$");
  return Number(n) !== N || Number(r) !== R || Number(p) !== P;
}

export const PASSWORD_MIN_LENGTH = 12;

const COMMON = new Set([
  "password1234", "passw0rd1234", "administrator", "iloveyou1234", "qwertyuiop12",
  "letmein12345", "welcome12345", "123456789012", "111111111111", "000000000000",
  "abcdefghijkl", "wefcanada123", "wefcanada2026", "wefadmin1234", "foundation12",
]);

/**
 * Length plus a check against the obviously guessable — no forced symbols or
 * digits, which push people toward "P@ssw0rd1" without adding strength
 * (NIST SP 800-63B). Returns an error message, or null when acceptable.
 */
export function passwordPolicyError(password: string, email = "", name = ""): string | null {
  if ([...password].length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  const lower = password.toLowerCase();
  if (/^(.)\1+$/u.test(lower)) return "Password cannot be one character repeated.";
  if (lower.includes("password") || lower.includes("qwerty")) {
    return 'Password must not contain "password" or "qwerty".';
  }
  if (/0123456789|1234567890|abcdefghij/.test(lower)) {
    return "Password must not be a run of consecutive characters.";
  }
  if (COMMON.has(lower)) return "That password is too common. Choose something less predictable.";

  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && lower.includes(local)) return "Password must not contain your email address.";
  for (const part of name.toLowerCase().split(/\s+/)) {
    if (part.length >= 4 && lower.includes(part)) return "Password must not contain your name.";
  }
  return null;
}
