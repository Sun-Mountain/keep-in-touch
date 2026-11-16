"use client";

import { useActionState, useEffect, useState } from "react";
import {
  confirmContactUpdate,
  type ConfirmContactUpdateState,
} from "./actions";
import type {
  ContactInputValues,
  ContactMatchCandidate,
} from "@/lib/contact-spreadsheet";

const initialState: ConfirmContactUpdateState = { status: "idle" };

export function ContactUpdateConfirmation({
  candidate,
  contact,
  onSkip,
  onUpdated,
}: {
  candidate: ContactMatchCandidate;
  contact: ContactInputValues;
  onSkip?: () => void;
  onUpdated?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    confirmContactUpdate,
    initialState,
  );
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (state.status === "success") onUpdated?.();
  }, [onUpdated, state.status]);

  if (state.status === "success") {
    return <p className="contact-update-success" role="status">{state.message}</p>;
  }
  if (skipped) {
    return <p className="contact-update-skipped" role="status">No changes made.</p>;
  }

  return (
    <form action={formAction} className="contact-update-confirmation">
      <input name="contactId" type="hidden" value={candidate.id} />
      <input
        name="expectedUpdatedAt"
        type="hidden"
        value={candidate.expectedUpdatedAt}
      />
      {Object.entries(contact).map(([field, value]) => (
        <input key={field} name={field} type="hidden" value={value} />
      ))}
      <p>Saved contact details: {candidate.description}.</p>
      {state.status === "error" && (
        <p className="contact-form-error" role="alert">{state.message}</p>
      )}
      <div className="contact-update-actions">
        <button className="submit-button" disabled={isPending} type="submit">
          {isPending ? "Updating..." : "Update existing contact"}
        </button>
        <button
          className="cancel-edit-button"
          disabled={isPending}
          onClick={() => {
            setSkipped(true);
            onSkip?.();
          }}
          type="button"
        >
          Skip
        </button>
      </div>
    </form>
  );
}
