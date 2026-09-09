import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as unlock } from "../app/api/access/route";
import { POST } from "../app/api/process-knowledge-base/route";

test("uploads reject unsupported documents, oversize files, invalid PDFs and excessive text before generation", async () => {
  const origin = "https://protosynthetic.test";
  const code = "test-only-access-code-with-at-least-32-bytes";
  process.env.PROTOSYNTHETIC_ACCESS_CODE = code;
  const access = await unlock(
    new NextRequest(`${origin}/api/access`, {
      method: "POST",
      headers: { origin },
      body: JSON.stringify({ code }),
    }),
  );
  const cookie = access.headers.get("set-cookie")!.split(";")[0];
  for (const [name, content, type, status] of [
    ["brief.docx", "unsupported", "application/octet-stream", 400],
    ["large.txt", "x".repeat(4 * 1024 * 1024 + 1), "text/plain", 413],
    ["broken.pdf", "not a pdf", "application/pdf", 400],
    ["long.txt", "x".repeat(100_001), "text/plain", 400],
    ["empty.txt", "", "text/plain", 400],
  ] as const) {
    const form = new FormData();
    form.set("type", "file");
    form.set("file", new File([content], name, { type }));
    const response = await POST(
      new NextRequest(`${origin}/api/process-knowledge-base`, {
        method: "POST",
        headers: { origin, cookie },
        body: form,
      }),
    );
    assert.equal(response.status, status, name);
  }
});
