import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://localhost:5055", headless: true, channel: "chrome" },
  webServer: {
    command: "npm run dev -- --port 5055",
    url: "http://localhost:5055",
    reuseExistingServer: !process.env.CI,
    env: {
      PROTOSYNTHETIC_ACCESS_CODE:
        "test-only-access-code-with-at-least-32-bytes",
      ANTHROPIC_API_KEY: "",
    },
  },
});
