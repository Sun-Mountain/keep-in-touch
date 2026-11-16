"use client";

import { useState, type FormEvent } from "react";
import { addContact } from "./actions";

export function ContactForm() {
  const [contactMethodError, setContactMethodError] = useState("");

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
  }

  return (
    <form action={addContact} className="contact-form" onSubmit={handleSubmit}>
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

      <button className="submit-button" type="submit">Add to your circle</button>
    </form>
  );
}
