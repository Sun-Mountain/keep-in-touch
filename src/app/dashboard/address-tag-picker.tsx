"use client";

import { useState } from "react";
import {
  addAddressTag,
  createAndAddAddressTag,
} from "@/app/dashboard/actions";

type TagOption = { id: string; name: string };

export function AddressTagPicker({
  contactId,
  tags,
  assignedTagIds,
}: {
  contactId: string;
  tags: TagOption[];
  assignedTagIds: string[];
}) {
  const [query, setQuery] = useState("");
  const search = query.trim();
  const normalizedSearch = search
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const assignedTagIdSet = new Set(assignedTagIds);
  const matchingTags = tags.filter(
    (tag) =>
      !assignedTagIdSet.has(tag.id) &&
      tag.name.toLowerCase().includes(search.toLowerCase()),
  );
  const exactTag = tags.find(
    (tag) =>
      tag.name.normalize("NFKC").replace(/\s+/g, " ").toLowerCase() ===
      normalizedSearch,
  );

  return (
    <form
      action={addAddressTag}
      className="contact-tag-add-form"
    >
      <input name="contactId" type="hidden" value={contactId} />
      <div className="address-tag-search">
        <input
          aria-label="Filter or create an address tag"
          autoComplete="off"
          maxLength={50}
          name="tagName"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter or create a tag"
          type="search"
          value={query}
        />
        {matchingTags.length > 0 && (
          <ul aria-label="Matching tags" className="address-tag-options">
            {matchingTags.map((tag) => (
              <li key={tag.id}>
                <button name="tagId" type="submit" value={tag.id}>
                  Add {tag.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {search && !exactTag && (
        <button formAction={createAndAddAddressTag} type="submit">
          Create &quot;{search}&quot; and add
        </button>
      )}
      {search && exactTag && assignedTagIdSet.has(exactTag.id) && (
        <p aria-live="polite" className="contact-tags-empty">
          This tag is already on the address.
        </p>
      )}
    </form>
  );
}
