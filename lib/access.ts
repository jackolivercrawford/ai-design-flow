import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const ACCESS_COOKIE = "protosynthetic_access";
export const ACCESS_SECONDS = 12 * 60 * 60;
export function accessSecret() {
  const secret = process.env.PROTOSYNTHETIC_ACCESS_CODE;
  return secret && Buffer.byteLength(secret) >= 32 ? secret : null;
}
export function matchesCode(code: string, secret: string) {
  return timingSafeEqual(
    createHash("sha256").update(code).digest(),
    createHash("sha256").update(secret).digest(),
  );
}
export function accessToken(secret: string) {
  const payload = `v1.${Math.floor(Date.now() / 1000) + ACCESS_SECONDS}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function authenticated(request: NextRequest) {
  const secret = accessSecret();
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!secret || !token || !/^v1\.\d{10}\.[A-Za-z0-9_-]{43}$/.test(token))
    return false;
  const [version, expiry, signature] = token.split(".");
  const remaining = Number(expiry) - Math.floor(Date.now() / 1000);
  if (remaining <= 0 || remaining > ACCESS_SECONDS) return false;
  const expected = createHmac("sha256", secret)
    .update(`${version}.${expiry}`)
    .digest("base64url");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export function sameOrigin(request: NextRequest) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
export function requireAccess(request: NextRequest) {
  if (!authenticated(request))
    return NextResponse.json(
      {
        error: "Unlock live generation to continue. Your saved work is safe.",
        code: "ACCESS_REQUIRED",
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  return null;
}
