import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";

const appEnvironment = process.env.PLAYWRIGHT_ENV ?? "development";
if (appEnvironment !== "development" && appEnvironment !== "production") {
  throw new Error("PLAYWRIGHT_ENV must be development or production.");
}

const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Set PLAYWRIGHT_DATABASE_URL to a disposable Playwright test database.");
}

const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
if (!databaseName.endsWith("_e2e")) {
  throw new Error("PLAYWRIGHT_DATABASE_URL must point to a database ending in _e2e.");
}

const baseURL = "http://localhost:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: [
      "pnpm exec prisma migrate deploy",
      appEnvironment === "production"
        ? "pnpm build && pnpm start --port 4173"
        : "pnpm dev --port 4173",
    ].join(" && "),
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
      CONTACT_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      NEXT_TELEMETRY_DISABLED: "1",
      PLAYWRIGHT_E2E: "1",
    },
  },
});
