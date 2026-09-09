import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as unlock } from "../app/api/access/route";
import { sampleRequirements } from "../lib/demo";

test("all paid routes reject unauthenticated input before reading it or creating a provider", async () => {
  process.env.ANTHROPIC_API_KEY = "test-placeholder-never-sent";
  const routes = await Promise.all([
    import("../app/api/generate-questions/route"),
    import("../app/api/generate-mockup/route"),
    import("../app/api/update-requirements/route"),
    import("../app/api/simplify-requirements/route"),
    import("../app/api/process-knowledge-base/route"),
  ]);
  delete process.env.ANTHROPIC_API_KEY;
  for (const route of routes) {
    const request = new NextRequest("https://protosynthetic.test/api/test", {
      method: "POST",
      body: "invalid",
      headers: { origin: "https://protosynthetic.test" },
    });
    request.json = async () => {
      throw new Error("Body must not be read");
    };
    request.formData = async () => {
      throw new Error("Upload must not be read");
    };
    const response = await route.POST(request);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "ACCESS_REQUIRED");
  }
});

test("authorized requests require the same origin and a missing provider key returns a useful error", async () => {
  const code = "test-only-access-code-with-at-least-32-bytes";
  process.env.PROTOSYNTHETIC_ACCESS_CODE = code;
  delete process.env.ANTHROPIC_API_KEY;
  const origin = "https://protosynthetic.test";
  const session = await unlock(
    new NextRequest(`${origin}/api/access`, {
      method: "POST",
      headers: { origin },
      body: JSON.stringify({ code }),
    }),
  );
  const cookie = session.headers.get("set-cookie")!.split(";")[0];
  const route = await import("../app/api/generate-mockup/route");
  const response = await route.POST(
    new NextRequest(`${origin}/api/generate-mockup`, {
      method: "POST",
      headers: { cookie, origin },
      body: JSON.stringify({ requirementsDoc: sampleRequirements }),
    }),
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /temporarily unavailable/);
  const forbidden = await route.POST(
    new NextRequest(`${origin}/api/generate-mockup`, {
      method: "POST",
      headers: { cookie, origin: "https://evil.test" },
      body: "invalid",
    }),
  );
  assert.equal(forbidden.status, 403);
});
