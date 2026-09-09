import { test, expect } from "@playwright/test";
import { previewDocument } from "../../lib/preview-document";

test("DaisyUI prototypes retain all supplied theme colors inside the isolated document", async ({
  page,
}) => {
  const colors = {
    primary: "#111111",
    "primary-focus": "#222222",
    "primary-content": "#eeeeee",
    secondary: "#333333",
    "secondary-focus": "#444444",
    "secondary-content": "#dddddd",
    accent: "#555555",
    "accent-focus": "#666666",
    "accent-content": "#cccccc",
    neutral: "#777777",
    "neutral-focus": "#888888",
    "neutral-content": "#bbbbbb",
    "base-100": "#f3f4f6",
    "base-200": "#e5e7eb",
    "base-300": "#d1d5db",
    "base-content": "#111827",
  };
  const fixture = `function ThemeFixture() {
    return <main className="bg-base-100 text-base-content p-8">
      <h1>Supplied theme</h1>
      <section className="bg-base-200">Second surface</section>
      <section className="bg-base-300">Third surface</section>
      {['primary','secondary','accent','neutral'].map(color => <button key={color} className={'btn btn-'+color}>{color}</button>)}
    </main>;
  }
  export default ThemeFixture;`;
  await page.setContent(
    '<iframe title="Themed prototype" sandbox="allow-scripts" style="width:100%;height:600px"></iframe>',
  );
  await page.locator("iframe").evaluate(
    (element, html) => {
      (element as HTMLIFrameElement).srcdoc = html;
    },
    previewDocument(fixture, colors),
  );
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: "Supplied theme" }),
  ).toBeVisible();
  await expect(frame.locator("main")).toHaveCSS(
    "background-color",
    "rgb(243, 244, 246)",
  );
  await expect(frame.locator("main")).toHaveCSS("color", "rgb(17, 24, 39)");
  await expect(frame.getByText("Second surface")).toHaveCSS(
    "background-color",
    "rgb(229, 231, 235)",
  );
  await expect(frame.getByText("Third surface")).toHaveCSS(
    "background-color",
    "rgb(209, 213, 219)",
  );
  for (const [name, base, focus, content] of [
    ["primary", "rgb(17, 17, 17)", "rgb(34, 34, 34)", "rgb(238, 238, 238)"],
    ["secondary", "rgb(51, 51, 51)", "rgb(68, 68, 68)", "rgb(221, 221, 221)"],
    ["accent", "rgb(85, 85, 85)", "rgb(102, 102, 102)", "rgb(204, 204, 204)"],
    [
      "neutral",
      "rgb(119, 119, 119)",
      "rgb(136, 136, 136)",
      "rgb(187, 187, 187)",
    ],
  ]) {
    const button = frame.getByRole("button", { name, exact: true });
    await expect(button).toHaveCSS("background-color", base);
    await expect(button).toHaveCSS("color", content);
    await button.hover();
    await expect(button).toHaveCSS("background-color", focus);
    await page.mouse.move(0, 0);
  }
  await expect(frame.locator("html")).toHaveAttribute("data-theme", "custom");
  await expect(page.locator("iframe")).toHaveAttribute(
    "sandbox",
    "allow-scripts",
  );
});
