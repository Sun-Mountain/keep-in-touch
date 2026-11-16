"use client";

import { eraseContacts } from "@/app/dashboard/actions";

export function EraseContactsButton() {
  return (
    <form
      action={eraseContacts}
      onSubmit={(event) => {
        if (!window.confirm("Permanently erase all contacts in your account?")) {
          event.preventDefault();
        }
      }}
    >
      <button className="erase-contacts-button" type="submit">
        Erase all my contacts
      </button>
    </form>
  );
}
