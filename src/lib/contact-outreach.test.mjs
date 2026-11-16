import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OUTREACH_MESSAGE,
  MAX_OUTREACH_RECIPIENTS,
  renderOutreachTemplate,
} from "./contact-outreach.js";

test("renders every name placeholder as literal contact text", () => {
  assert.equal(
    renderOutreachTemplate("Hi {{name}}; {{ NAME }}", "$& Casey"),
    "Hi $& Casey; $& Casey",
  );
});

test("defines a bounded outreach batch and a default message", () => {
  assert.equal(MAX_OUTREACH_RECIPIENTS, 25);
  assert.match(DEFAULT_OUTREACH_MESSAGE, /\{\{name\}\}/);
});
