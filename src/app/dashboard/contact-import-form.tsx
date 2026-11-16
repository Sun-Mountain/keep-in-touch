"use client";

import { useActionState } from "react";
import { importContacts } from "./actions";
import type { ContactImportState } from "@/lib/contact-spreadsheet";

const initialState: ContactImportState = { status: "idle" };

export function ContactImportForm() {
  const [state, formAction, isPending] = useActionState(importContacts, initialState);

  return (
    <form action={formAction} className="contact-form contact-import-form">
      <label>
        Spreadsheet file
        <input accept=".xlsx,.csv" name="file" type="file" />
      </label>

      <p className="import-divider">or</p>

      <label>
        Public Google Sheets link
        <input
          autoComplete="url"
          name="spreadsheetUrl"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          type="url"
        />
      </label>

      <p className="import-help">
        Choose one source. The sheet must be public or published; private sheets are not supported.
        Imports use the first worksheet and support up to 5,000 rows and 4 MB.
      </p>
      <a className="import-template-link" download href="/contact-import-template.csv">
        Download the CSV template
      </a>

      <button className="submit-button" disabled={isPending} type="submit">
        {isPending ? "Importing..." : "Import contacts"}
      </button>

      {state.status === "error" && (
        <p className="contact-import-error" role="alert">{state.message}</p>
      )}
      {state.status === "complete" && (
        <div aria-live="polite" className="contact-import-result" role="status">
          <p>
            Imported {state.imported} contact{state.imported === 1 ? "" : "s"}; skipped {state.skipped}.
          </p>
          {state.issues.length > 0 && (
            <details>
              <summary>View skipped rows</summary>
              <ul>
                {state.issues.map((issue, index) => <li key={index}>{issue}</li>)}
              </ul>
              {state.additionalIssues > 0 && (
                <p>{state.additionalIssues} more issue(s) not shown.</p>
              )}
            </details>
          )}
          {state.warnings.length > 0 && (
            <div className="contact-import-warning">
              <p>
                Important info is missing for {state.warnings.length + state.additionalWarnings} imported
                contact{state.warnings.length + state.additionalWarnings === 1 ? "" : "s"}.
              </p>
              <details>
                <summary>View contacts without email or phone</summary>
                <ul>
                  {state.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                </ul>
                {state.additionalWarnings > 0 && (
                  <p>{state.additionalWarnings} more contact(s) not shown.</p>
                )}
              </details>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
