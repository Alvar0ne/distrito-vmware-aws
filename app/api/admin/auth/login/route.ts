import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_SECONDS,
  createAdminSession
} from "@/lib/adminSession";
import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const attempts = new Map<string, { count: number; resetAt: number }>();
const attemptWindowMs = 15 * 60 * 1000;

function verifyPassword(password: string, storedValue: string) {
  const [salt, expectedHex] = storedValue.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const received = pbkdf2Sync(password, salt, 210_000, expected.length, "sha256");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  const clientId = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = attempts.get(clientId);

  if (current && current.resetAt > now && current.count >= 5) {
    return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";
  const expectedUsername = process.env.ADMIN_USERNAME || "admin";
  const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? "";
  const plainPassword = process.env.ADMIN_PASSWORD_PLAIN ?? "160116As";
  const sessionSecret = process.env.ADMIN_SESSION_SECRET || "distrito-miami-temporary-admin-session";
  const valid =
    username === expectedUsername &&
    (verifyPassword(password, passwordHash) || password === plainPassword);

  if (!valid) {
    attempts.set(clientId, {
      count: current && current.resetAt > now ? current.count + 1 : 1,
      resetAt: current && current.resetAt > now ? current.resetAt : now + attemptWindowMs
    });
    return NextResponse.json({ error: "Usuario o clave incorrectos." }, { status: 401 });
  }

  attempts.delete(clientId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: await createAdminSession(username, sessionSecret),
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS
  });
  return response;
}
