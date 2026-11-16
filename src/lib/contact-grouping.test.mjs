import assert from "node:assert/strict";
import test from "node:test";
import { groupContactsByAddress } from "./contact-grouping.js";

test("groups complete addresses after normalizing case and whitespace", () => {
  const contacts = [
    {
      id: "1",
      addressLine1: "123 Main Street",
      addressLine2: null,
      addressCity: "Portland",
      addressRegion: "Oregon",
      addressPostalCode: "97201",
      addressCountry: null,
    },
    {
      id: "2",
      addressLine1: " 123   MAIN STREET ",
      addressLine2: "",
      addressCity: "PORTLAND",
      addressRegion: "OREGON",
      addressPostalCode: "97201",
      addressCountry: "",
    },
    {
      id: "3",
      addressLine1: "123 Main Street",
      addressLine2: "Apt 2",
      addressCity: "Portland",
      addressRegion: "Oregon",
      addressPostalCode: "97201",
      addressCountry: null,
    },
    {
      id: "4",
      addressLine1: "123 Main Street",
      addressLine2: null,
      addressCity: null,
      addressRegion: "Oregon",
      addressPostalCode: "97201",
      addressCountry: null,
    },
  ];

  const groups = groupContactsByAddress(contacts);
  assert.deepEqual(
    groups.map((group) => group.contacts.map((contact) => contact.id)),
    [["1", "2"], ["3"], ["4"]],
  );
  assert.equal(groups[0].key !== null, true);
  assert.equal(groups[2].key, null);
});
