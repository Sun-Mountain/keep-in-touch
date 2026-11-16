import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";

const appEnvironment = process.env.PLAYWRIGHT_ENV ?? "development";
let testEmail: string | undefined;

test.afterEach(async () => {
  if (!testEmail) return;

  const client = new Client({
    connectionString: process.env.PLAYWRIGHT_DATABASE_URL,
  });
  await client.connect();
  try {
    await client.query('DELETE FROM "User" WHERE email = $1', [testEmail]);
  } finally {
    await client.end();
    testEmail = undefined;
  }
});

test("shows the erase button only in development and erases the signed-in user's contacts", async ({
  page,
}) => {
  testEmail = `playwright-${randomUUID()}@example.test`;

  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Playwright Test");
  await page.getByLabel("Email address").fill(testEmail);
  await page.getByLabel("Password").fill("playwright-test-password");
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const eraseButton = page.getByRole("button", { name: "Erase all my contacts" });
  if (appEnvironment === "production") {
    await expect(eraseButton).toHaveCount(0);
    return;
  }

  await expect(eraseButton).toBeVisible();
  await page.getByText("A new connection", { exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Playwright Contact");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("contact@example.test");
  await page.getByLabel("Street address").fill("123 Test Street");
  await page.getByLabel("City").fill("Testville");
  await page.getByLabel("State / province / region").fill("Test State");
  await page.getByLabel("Postal code").fill("12345");
  await page.getByRole("button", { name: "Add to your circle" }).click();
  await expect(page.getByRole("heading", { name: "Playwright Contact" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.dismiss());
  await eraseButton.click();
  await expect(page.getByRole("heading", { name: "Playwright Contact" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await eraseButton.click();
  await expect(page.getByText("Your circle is ready to grow.")).toBeVisible();
});
