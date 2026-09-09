import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../app/api/access/route";

const origin = "https://protosynthetic.test";
const secret = "test-only-access-code-with-at-least-32-bytes";
process.env.PROTOSYNTHETIC_ACCESS_CODE = secret;
const request = (
  method: string,
  body?: unknown,
  cookie?: string,
  source = origin,
) =>
  new NextRequest(`${origin}/api/access`, {
    method,
    headers: { origin: source, ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

test("access is private, origin-bound, signed, expiring, and revocable", async () => {
  assert.deepEqual(await (await GET(request("GET"))).json(), {
    authenticated: false,
  });
  assert.equal(
    (
      await POST(
        request("POST", { code: secret }, undefined, "https://evil.test"),
      )
    ).status,
    403,
  );
  assert.equal(
    (await POST(request("POST", { code: "incorrect" }))).status,
    401,
  );
  assert.equal(
    (await POST(request("POST", { code: "x".repeat(300) }))).status,
    400,
  );
  const unlocked = await POST(request("POST", { code: secret }));
  assert.equal(unlocked.status, 200);
  const setCookie = unlocked.headers.get("set-cookie")!;
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=strict/i);
  if (process.env.NODE_ENV === "production") assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /Max-Age=43200/i);
  assert.doesNotMatch(setCookie, /Domain=/i);
  const cookie = setCookie.split(";")[0];
  assert.equal(
    (await (await GET(request("GET", undefined, cookie))).json()).authenticated,
    true,
  );
  assert.equal(
    (await GET(request("GET"))).headers.get("cache-control"),
    "no-store",
  );
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 13 * 60 * 60 * 1000;
    assert.equal(
      (await (await GET(request("GET", undefined, cookie))).json())
        .authenticated,
      false,
    );
  } finally {
    Date.now = originalNow;
  }
  for (const invalid of [
    cookie + "x",
    cookie.replace(/v1\.\d+\./, "v1.1."),
    "protosynthetic_access=garbage",
  ]) {
    assert.equal(
      (await (await GET(request("GET", undefined, invalid))).json())
        .authenticated,
      false,
    );
  }
  process.env.PROTOSYNTHETIC_ACCESS_CODE = secret + "-rotated";
  assert.equal(
    (await (await GET(request("GET", undefined, cookie))).json()).authenticated,
    false,
  );
  process.env.PROTOSYNTHETIC_ACCESS_CODE = secret;
  assert.match(
    (await DELETE(request("DELETE"))).headers.get("set-cookie")!,
    /Max-Age=0/i,
  );
});
