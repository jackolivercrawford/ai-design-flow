import { test, expect } from "@playwright/test";

test("prepared example is interactive without API calls or session storage access", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Sample accessed localStorage");
      },
    });
  });
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/")) requests.push(request.url());
  });
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "A little room to focus" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Requirements" }).click();
  await expect(page.getByText("A clear focus for today")).toBeVisible();
  await page.getByRole("tab", { name: "Prototype", exact: true }).click();
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: "Make room for good work." }),
  ).toBeVisible({ timeout: 30000 });
  await frame.getByRole("button", { name: "Plan the launch" }).click();
  await expect(frame.getByText("1 of 3 complete")).toBeVisible();
  await page.getByLabel("Prototype version").selectOption("sample-v1");
  await expect(
    frame.getByRole("heading", { name: "Today, with intention." }),
  ).toBeVisible();
  await expect(page.locator("iframe")).toHaveAttribute(
    "sandbox",
    "allow-scripts",
  );
  const isolated = await page.frames()[1].evaluate(() => {
    let parentDenied = false;
    let storageDenied = false;
    try {
      void parent.document.body;
    } catch {
      parentDenied = true;
    }
    try {
      void window.localStorage;
    } catch {
      storageDenied = true;
    }
    return { parentDenied, storageDenied };
  });
  expect(isolated).toEqual({ parentDenied: true, storageDenied: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML" }).click();
  expect((await download).suggestedFilename()).toBe(
    "focus-room-sample-v1.html",
  );
  await page.getByRole("tab", { name: "Code", exact: true }).click();
  await expect(page.locator("pre")).toContainText("FocusRoom");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Prototype", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    frame.getByRole("heading", { name: "Today, with intention." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/demo-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.getByLabel("Prototype version").selectOption("sample-v2");
  await expect(
    frame.getByRole("heading", { name: "Make room for good work." }),
  ).toBeVisible();
  await expect(page.locator("main")).toHaveCSS(
    "background-color",
    "rgb(249, 250, 251)",
  );
  await page.screenshot({
    path: "test-results/demo-desktop.png",
    fullPage: true,
  });
});
