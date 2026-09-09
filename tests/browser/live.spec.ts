import { test, expect } from "@playwright/test";
import { sampleRequirements, sampleTree, sampleVersions } from "../../lib/demo";

const code = "test-only-access-code-with-at-least-32-bytes";
test("live access is gated and unlocking does not repeat an interrupted automated request", async ({
  page,
}) => {
  const progress = {
    qaTree: sampleTree,
    currentNodeId: "focus",
    questionCount: 3,
    prompt: "Test creative planner",
    requirementsDoc: sampleRequirements,
    settings: {
      traversalMode: "bfs",
      knowledgeBase: [
        {
          id: "fixture",
          type: "text",
          name: "Fixture brief",
          content: "Three priorities",
          processedContent: { requirements: ["Three priorities"] },
        },
      ],
    },
  };
  await page.addInitScript(
    (data) => {
      localStorage.setItem("qaProgress", JSON.stringify(data.progress));
      localStorage.setItem("mockupVersions", JSON.stringify(data.versions));
    },
    { progress, versions: sampleVersions },
  );
  let questions = 0;
  let updates = 0;
  await page.route("**/api/generate-questions", (route) => {
    questions++;
    return route.fulfill({
      json: {
        suggestedAnswer: "Three priorities with a calm progress summary.",
      },
    });
  });
  await page.route("**/api/update-requirements", (route) => {
    updates++;
    return route.fulfill({
      status: 401,
      json: { code: "ACCESS_REQUIRED", error: "Unlock to continue" },
    });
  });
  await page.goto("/qna");
  await page.getByRole("button", { name: "Start Auto-Answer" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(updates).toBe(1);
  await page.getByLabel("Access code").fill(code);
  await page.getByRole("button", { name: "Unlock live generation" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Start Auto-Answer" }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  expect(updates).toBe(1);
  expect(questions).toBe(1);
  const saved = await page.evaluate(() => ({
    progress: JSON.parse(localStorage.getItem("qaProgress")!),
    versions: JSON.parse(localStorage.getItem("mockupVersions")!),
  }));
  expect(saved.progress.qaTree.children[0].children[0].answer).toBe(
    "Three priorities with a calm progress summary.",
  );
  expect(saved.versions).toHaveLength(2);
});

test("create flow requires access and a new session cannot silently overwrite saved work", async ({
  page,
}) => {
  await page.goto("/create");
  await expect(page.getByLabel("Access code")).toBeVisible();
  await page.getByLabel("Access code").fill(code);
  await page.getByRole("button", { name: "Unlock live generation" }).click();
  await expect(page.getByLabel("Enter your design prompt:")).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem(
      "qaProgress",
      JSON.stringify({
        prompt: "Saved work",
        questionCount: 1,
        settings: { traversalMode: "bfs" },
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "Start New Session" }).click();
  await page.getByLabel("Enter your design prompt:").fill("New test planner");
  await page.getByRole("button", { name: "Configure Settings" }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: /Start.*Q&A/i }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("qaProgress")!).prompt,
    ),
  ).toBe("Saved work");
});
