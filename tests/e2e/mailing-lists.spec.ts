import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";

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

test("saves, prints, and deletes reusable lists from all or selected contacts", async ({
  page,
}) => {
  testEmail = `mailing-lists-${randomUUID()}@example.test`;
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = "true";
    };
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Playwright Test");
  await page.getByLabel("Email address").fill(testEmail);
  await page.getByLabel("Password").fill("playwright-test-password");
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const addContactSummary = page
    .locator("details.add-contact-panel")
    .filter({ hasText: "A new connection" })
    .locator("summary");
  for (const [index, name] of ["Jamie Taylor", "Alex Morgan"].entries()) {
    const isOpen = await addContactSummary.evaluate((summary) =>
      summary.parentElement?.hasAttribute("open"),
    );
    if (!isOpen) await addContactSummary.click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(
      `mailing-contact-${index}@example.test`,
    );
    await page.getByLabel("Street address").fill("123 Test Street");
    await page.getByLabel("City").fill("Testville");
    await page.getByLabel("State / province / region").fill("Test State");
    await page.getByLabel("Postal code").fill("12345");
    await page.getByRole("button", { name: "Add to your circle" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }

  const listSection = page.getByRole("region", { name: "Mailing lists" });
  await listSection.getByLabel("List name").fill("Holiday cards");
  await listSection.getByRole("button", { name: "Select all contacts" }).click();
  await expect(listSection.getByText("2 selected")).toBeVisible();
  await listSection.getByRole("button", { name: "Save mailing list" }).click();

  const savedAllList = listSection.locator(".saved-mailing-list").first();
  await expect(savedAllList.locator("summary")).toContainText("Holiday cards");
  await expect(savedAllList.getByText("2 people · 1 address")).toBeVisible();
  await savedAllList.locator("summary").click();
  await savedAllList.getByRole("button", { name: "Print addresses" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-requested", "true");

  await listSection.getByRole("button", { name: "Clear selection" }).click();
  await listSection.getByLabel("List name").fill("Just Jamie");
  await listSection.getByLabel(/Jamie Taylor/).check();
  await listSection.getByRole("button", { name: "Save mailing list" }).click();
  const justJamieList = listSection.locator(".saved-mailing-list").nth(1);
  await expect(justJamieList.locator("summary")).toContainText("Just Jamie");
  await expect(justJamieList.getByText("1 person · 1 address")).toBeVisible();
  await justJamieList.getByRole("button", { name: "Delete list" }).click();
  await expect(listSection.locator(".saved-mailing-list")).toHaveCount(1);
});
