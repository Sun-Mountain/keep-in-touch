import assert from "node:assert/strict";
import test from "node:test";
import {
  hasSameContactInformation,
  normalizeContactName,
} from "./contact-duplicates.js";

test("normalizes names and recognizes identical contact details", () => {
  const existing = {
    name: "Alex Morgan",
    email: "alex@example.com",
    phone: "(555) 123-4567",
    birthday: new Date("1990-04-03T00:00:00.000Z"),
    familyMembers: "Jamie Morgan",
    addressLine1: "123 Main Street",
    addressLine2: null,
    addressCity: "Portland",
    addressRegion: "Oregon",
    addressPostalCode: "97201",
    addressCountry: null,
    company: "Example Co",
    notes: "Prefers email",
  };
  const repeated = {
    ...existing,
    name: "  ALEX  MORGAN ",
    email: "ALEX@EXAMPLE.COM ",
    phone: "5551234567",
    addressLine1: " 123   Main Street ",
  };

  assert.equal(normalizeContactName(repeated.name), "alex morgan");
  assert.equal(hasSameContactInformation(existing, repeated), true);
  assert.equal(
    hasSameContactInformation(existing, { ...repeated, notes: "Prefers calls" }),
    false,
  );
});
