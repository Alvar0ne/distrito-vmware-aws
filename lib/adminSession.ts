export const ADMIN_SESSION_COOKIE = "dm_admin_session";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function createAdminSession(username: string, secret: string) {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ username, expiresAt: Date.now() + ADMIN_SESSION_SECONDS * 1000 }))
  );
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifyAdminSession(token: string | undefined, secret: string) {
  if (!token || !secret) return false;
  const [payload, receivedSignature, extra] = token.split(".");
  if (!payload || !receivedSignature || extra) return false;

  const expectedSignature = await sign(payload, secret);
  if (!secureEqual(receivedSignature, expectedSignature)) return false;

  try {
    const parsed = JSON.parse(decoder.decode(fromBase64Url(payload))) as {
      username?: string;
      expiresAt?: number;
    };
    return Boolean(parsed.username) && Number(parsed.expiresAt) > Date.now();
  } catch {
    return false;
  }
}
