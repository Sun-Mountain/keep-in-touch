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

test("prepares individual personal email and text drafts for selected contacts", async ({
  page,
}) => {
  testEmail = `outreach-${randomUUID()}@example.test`;

  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Playwright Test");
  await page.getByLabel("Email address").fill(testEmail);
  await page.getByLabel("Password").fill("playwright-test-password");
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByLabel("Proton custom-domain email address"),
  ).toBeVisible();
  await expect(page.getByLabel("Proton SMTP token")).toHaveAttribute("type", "password");

  await page.getByText("A new connection", { exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Jamie Taylor");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("jamie@example.test");
  await page.getByLabel("Phone number").fill("+15551234567");
  await page.getByLabel("Street address").fill("123 Test Street");
  await page.getByLabel("City").fill("Testville");
  await page.getByLabel("State / province / region").fill("Test State");
  await page.getByLabel("Postal code").fill("12345");
  await page.getByRole("button", { name: "Add to your circle" }).click();
  await expect(page.getByRole("heading", { name: "Jamie Taylor" })).toBeVisible();

  await page.getByRole("checkbox", { name: "Select Jamie Taylor" }).check();
  await page.getByRole("button", { name: "Prepare email drafts" }).click();
  const emailDraft = page.getByRole("link", {
    name: "Open email draft for Jamie Taylor",
  });
  await expect(emailDraft).toHaveAttribute("href", /^mailto:/);
  const emailHref = await emailDraft.getAttribute("href");
  const emailDraftBody = new URLSearchParams(
    (emailHref ?? "").split("?")[1],
  ).get("body");
  expect(emailDraftBody).toContain("Hi Jamie Taylor");

  const client = new Client({
    connectionString: process.env.PLAYWRIGHT_DATABASE_URL,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT id FROM "User" WHERE email = $1',
      [testEmail],
    );
    if (!rows[0]) throw new Error("Playwright user was not found.");
    await client.query(
      `INSERT INTO "ProtonConnection"
        ("id", "userId", "email", "encryptedSmtpToken", "updatedAt")
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [randomUUID(), rows[0].id, "sender@example.test", "test-token"],
    );
  } finally {
    await client.end();
  }
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Send through Proton Mail SMTP" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Send through Proton Mail SMTP" }).check();
  await page.getByRole("checkbox", { name: "Select Jamie Taylor" }).check();
  await page.getByRole("button", { name: "Review 1 separate emails" }).click();
  await expect(
    page.getByText(/These messages will be sent separately from sender@example\.test using Proton SMTP/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit selection or message" }).click();
  await page.getByRole("radio", { name: "Open drafts in my email app" }).check();
  await page.getByRole("button", { name: "Prepare email drafts" }).click();

  await page.getByRole("radio", { name: "Text" }).check();
  await page.getByRole("checkbox", { name: "Select Jamie Taylor" }).check();
  await page.getByRole("button", { name: "Prepare text drafts" }).click();
  await expect(
    page.getByRole("link", { name: "Open text draft for Jamie Taylor" }),
  ).toHaveAttribute("href", /^sms:/);
});
