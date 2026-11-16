"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { updateContact } from "./actions";

type EditableContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string;
  familyMembers: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  company: string | null;
  notes: string | null;
};

const initialState = { error: "", success: false };

export function ContactEditor({ contact }: { contact: EditableContact }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editSession, setEditSession] = useState(0);
  const closeEditor = useCallback(() => setIsEditing(false), []);

  return (
    <div className="contact-editor">
      <button
        aria-expanded={isEditing}
        className="edit-contact-button"
        onClick={() => {
          setEditSession((session) => session + 1);
          setIsEditing((editing) => !editing);
        }}
        type="button"
      >
        {isEditing ? "Cancel edit" : "Edit contact"}
      </button>
      {isEditing && (
        <ContactEditForm
          contact={contact}
          key={editSession}
          onCancel={closeEditor}
          onSaved={closeEditor}
        />
      )}
    </div>
  );
}

function ContactEditForm({
  contact,
  onCancel,
  onSaved,
}: {
  contact: EditableContact;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, isPending] = useActionState(updateContact, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [onSaved, state]);

  return (
    <form action={formAction} className="contact-form contact-edit-form">
      <input name="id" type="hidden" value={contact.id} />

      <label>
        Name
        <input autoComplete="name" defaultValue={contact.name} name="name" required />
      </label>

      <div className="contact-field-grid">
        <label>
          Email
          <input autoComplete="email" defaultValue={contact.email ?? ""} name="email" type="email" />
        </label>
        <label>
          Phone number
          <input autoComplete="tel" defaultValue={contact.phone ?? ""} name="phone" type="tel" />
        </label>
        <label>
          Birthday (optional)
          <input autoComplete="bday" defaultValue={contact.birthday} name="birthday" type="date" />
        </label>
        <label>
          Company (optional)
          <input autoComplete="organization" defaultValue={contact.company ?? ""} name="company" />
        </label>
      </div>

      <label>
        Family members (optional)
        <textarea defaultValue={contact.familyMembers ?? ""} name="familyMembers" rows={3} />
      </label>

      <fieldset className="address-fields">
        <legend>Mailing address (required)</legend>
        <label>
          Street address
          <input
            autoComplete="address-line1"
            defaultValue={contact.addressLine1 ?? ""}
            name="addressLine1"
            required
          />
        </label>
        <label>
          Apartment, suite, etc. (optional)
          <input
            autoComplete="address-line2"
            defaultValue={contact.addressLine2 ?? ""}
            name="addressLine2"
          />
        </label>
        <div className="contact-field-grid">
          <label>
            City
            <input autoComplete="address-level2" defaultValue={contact.addressCity ?? ""} name="addressCity" required />
          </label>
          <label>
            State / province / region
            <input autoComplete="address-level1" defaultValue={contact.addressRegion ?? ""} name="addressRegion" required />
          </label>
          <label>
            Postal code
            <input autoComplete="postal-code" defaultValue={contact.addressPostalCode ?? ""} name="addressPostalCode" required />
          </label>
          <label>
            Country (optional)
            <input autoComplete="country-name" defaultValue={contact.addressCountry ?? ""} name="addressCountry" />
          </label>
        </div>
      </fieldset>

      <label>
        Notes (optional)
        <textarea defaultValue={contact.notes ?? ""} name="notes" rows={3} />
      </label>

      {state.error && <p className="contact-form-error" role="alert">{state.error}</p>}
      <div className="contact-edit-actions">
        <button className="submit-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save changes"}
        </button>
        <button className="cancel-edit-button" disabled={isPending} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
