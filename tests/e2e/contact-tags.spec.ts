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

test("creates, deletes, adds, and removes address tags", async ({ page }) => {
  testEmail = `contact-tags-${randomUUID()}@example.test`;

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
  for (const [index, name] of [
    "Playwright Contact",
    "Second Playwright Contact",
  ].entries()) {
    const isOpen = await addContactSummary.evaluate((summary) =>
      summary.parentElement?.hasAttribute("open"),
    );
    if (!isOpen) await addContactSummary.click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(
      `contact-${index}@example.test`,
    );
    await page.getByLabel("Street address").fill("123 Test Street");
    await page.getByLabel("City").fill("Testville");
    await page.getByLabel("State / province / region").fill("Test State");
    await page.getByLabel("Postal code").fill("12345");
    await page.getByRole("button", { name: "Add to your circle" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }

  const tagManager = page.locator(".contact-tag-manager");
  await tagManager.getByLabel("Tag name").fill("Family");
  await tagManager.getByRole("button", { name: "Create tag" }).click();
  await expect(tagManager.getByRole("list", { name: "Created tags" })).toContainText(
    "Family",
  );

  const addressCard = page.locator(".contact-list > .shared-address-card");
  await expect(addressCard).toHaveCount(1);
  const contactIds = await addressCard
    .locator(".shared-contact-person input[name=id]")
    .evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
  const client = new Client({
    connectionString: process.env.PLAYWRIGHT_DATABASE_URL,
  });
  await client.connect();
  try {
    const tagResult = await client.query(
      'SELECT id FROM "Tag" WHERE "userId" = (SELECT id FROM "User" WHERE email = $1) AND "normalizedName" = $2',
      [testEmail, "family"],
    );
    await client.query(
      'INSERT INTO "ContactTag" ("contactId", "tagId") VALUES ($1, $2)',
      [contactIds[0], tagResult.rows[0].id],
    );
  } finally {
    await client.end();
  }
  await page.reload();
  const refreshedAddressCard = page.locator(".contact-list > .shared-address-card");
  await expect(refreshedAddressCard.locator(".address-tag-editor")).toContainText(
    "Family",
  );

  const addressTagEditor = refreshedAddressCard.locator(".address-tag-editor");
  await expect(refreshedAddressCard.locator(".shared-contact-people .address-tag-editor"))
    .toHaveCount(0);
  const addressTags = addressTagEditor.getByRole("list", {
    name: "Address tags",
  });
  await expect(addressTags).toContainText("Family");

  await addressTags
    .getByRole("button", { name: "Remove Family tag from this address" })
    .click();
  await expect(addressTags).toHaveCount(0);
  await expect(addressTagEditor.getByText("No tags")).toBeVisible();

  await addressTagEditor.getByLabel("Add tag to this address").selectOption({
    label: "Family",
  });
  await addressTagEditor.getByRole("button", { name: "Add tag" }).click();
  await expect(addressTagEditor.getByRole("list", {
    name: "Address tags",
  })).toContainText("Family");

  await tagManager.getByRole("button", { name: "Delete tag Family" }).click();
  await expect(tagManager.getByRole("list", { name: "Created tags" })).toHaveCount(0);
  await expect(addressTagEditor.getByText("No tags")).toBeVisible();
});
