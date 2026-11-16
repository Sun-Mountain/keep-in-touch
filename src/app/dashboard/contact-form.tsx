"use client";

import { useActionState, useState, type FormEvent } from "react";
import { addContact } from "./actions";
import type { AddContactState } from "./actions";
import { ContactUpdateConfirmation } from "./contact-update-confirmation";

const initialState: AddContactState = { status: "idle" };

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(addContact, initialState);
  const [contactMethodError, setContactMethodError] = useState("");
  const [manualUpdateComplete, setManualUpdateComplete] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();

    if (!email && !phone) {
      event.preventDefault();
      setContactMethodError("Provide either an email address or a phone number.");
      return;
    }

    setContactMethodError("");
    setManualUpdateComplete(false);
  }

  return (
    <>
    <form action={formAction} className="contact-form" onSubmit={handleSubmit}>
      <label>
        Name
        <input autoComplete="name" name="name" placeholder="Alex Morgan" required />
      </label>

      <div className="contact-field-grid">
        <label>
          Email
          <input
            aria-describedby={contactMethodError ? "contact-method-error" : undefined}
            autoComplete="email"
            name="email"
            placeholder="alex@example.com"
            type="email"
          />
        </label>
        <label>
          Phone number
          <input
            aria-describedby={contactMethodError ? "contact-method-error" : undefined}
            autoComplete="tel"
            name="phone"
            placeholder="(555) 123-4567"
            type="tel"
          />
        </label>
        <p className="contact-method-hint">Enter an email or a phone number.</p>
        {contactMethodError && (
          <p className="contact-form-error" id="contact-method-error" role="alert">
            {contactMethodError}
          </p>
        )}
        <label>
          Birthday (optional)
          <input autoComplete="bday" name="birthday" type="date" />
        </label>
        <label>
          Company (optional)
          <input autoComplete="organization" name="company" placeholder="Company name" />
        </label>
      </div>

      <label>
        Family members (optional)
        <textarea
          name="familyMembers"
          placeholder="Add one name per line"
          rows={3}
        />
      </label>

      <fieldset className="address-fields">
        <legend>Mailing address (required)</legend>
        <label>
          Street address
          <input autoComplete="address-line1" name="addressLine1" placeholder="123 Main Street" required />
        </label>
        <label>
          Apartment, suite, etc. (optional)
          <input autoComplete="address-line2" name="addressLine2" placeholder="Apt 4B" />
        </label>
        <div className="contact-field-grid">
          <label>
            City
            <input autoComplete="address-level2" name="addressCity" placeholder="City" required />
          </label>
          <label>
            State / province / region
            <input autoComplete="address-level1" name="addressRegion" placeholder="State or region" required />
          </label>
          <label>
            Postal code
            <input autoComplete="postal-code" name="addressPostalCode" placeholder="Postal code" required />
          </label>
          <label>
            Country (optional)
            <input autoComplete="country-name" name="addressCountry" placeholder="Country" />
          </label>
        </div>
      </fieldset>

      <label>
        Notes (optional)
        <textarea name="notes" placeholder="Anything you would like to remember" rows={3} />
      </label>

      <button className="submit-button" disabled={isPending} type="submit">
        {isPending ? "Checking..." : "Add to your circle"}
      </button>
    </form>
    {state.status === "error" && (
      <p className="contact-form-error" role="alert">{state.message}</p>
    )}
    {state.status === "duplicate" && (
      <p className="contact-duplicate-notice" role="status">{state.message}</p>
    )}
    {state.status === "complete" && (
      <p className="contact-update-success" role="status">{state.message}</p>
    )}
    {state.status === "confirm-update" && (
      <div className="contact-duplicate-notice">
        <p role="status">{state.message}</p>
        {manualUpdateComplete ? (
          <p className="contact-update-success" role="status">
            Contact information updated.
          </p>
        ) : (
          state.candidates.map((candidate) => (
            <ContactUpdateConfirmation
              candidate={candidate}
              contact={state.contact}
              key={candidate.id}
              onUpdated={() => setManualUpdateComplete(true)}
            />
          ))
        )}
      </div>
    )}
    </>
  );
}
