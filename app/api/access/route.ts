import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_SECONDS,
  accessSecret,
  accessToken,
  authenticated,
  matchesCode,
  sameOrigin,
} from "@/lib/access";

export const runtime = "nodejs";
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  return json({ authenticated: authenticated(request) });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return json({ error: "Request origin is not allowed." }, 403);
  if (Number(request.headers.get("content-length")) > 1024)
    return json({ error: "Access code is too long." }, 400);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 1024)
      return json({ error: "Access code is too long." }, 400);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Enter a valid access code." }, 400);
  }
  if (
    typeof body?.code !== "string" ||
    !body.code.length ||
    body.code.length > 256
  )
    return json({ error: "Enter a valid access code." }, 400);
  const secret = accessSecret();
  if (!secret)
    return json(
      {
        error:
          "Live generation is not configured yet. Explore the prepared example.",
      },
      503,
    );
  if (!matchesCode(body.code, secret))
    return json({ error: "That access code was not recognized." }, 401);
  const response = json({ authenticated: true });
  response.cookies.set(ACCESS_COOKIE, accessToken(secret), {
    ...options,
    maxAge: ACCESS_SECONDS,
  });
  return response;
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request))
    return json({ error: "Request origin is not allowed." }, 403);
  const response = json({ authenticated: false });
  response.cookies.set(ACCESS_COOKIE, "", { ...options, maxAge: 0 });
  return response;
}
