"use client";

import { useState } from "react";
import { updateAddressLabelName } from "./actions";

export function AddressLabelNameEditor({
  contactIds,
  addressLabelName,
  className,
}: {
  contactIds: string[];
  addressLabelName: string | null;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const formId = `address-label-name-${contactIds[0]}`;

  return (
    <div className={className ?? "contact-address-label-editor"}>
      <button
        aria-controls={formId}
        aria-expanded={isOpen}
        className="contact-address-label-toggle"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {addressLabelName ? "Change address name" : "Set address name"}
      </button>
      <form
        action={updateAddressLabelName}
        className="contact-address-label-form"
        hidden={!isOpen}
        id={formId}
      >
        {contactIds.map((id) => (
          <input key={id} name="contactId" type="hidden" value={id} />
        ))}
        <label>
          Alternative address name
          <input
            defaultValue={addressLabelName ?? ""}
            maxLength={100}
            name="addressLabelName"
            placeholder="Household or organization name"
          />
        </label>
        <button type="submit">Save name</button>
      </form>
    </div>
  );
}
