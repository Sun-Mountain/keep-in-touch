"use client";

import { useActionState, useState } from "react";
import { importContacts } from "./actions";
import type { ContactImportState } from "@/lib/contact-spreadsheet";
import { ContactUpdateConfirmation } from "./contact-update-confirmation";

const initialState: ContactImportState = { status: "idle" };

export function ContactImportForm() {
  const [state, formAction, isPending] = useActionState(importContacts, initialState);
  const [skippedUpdates, setSkippedUpdates] = useState<Set<number>>(new Set());
  const [completedUpdates, setCompletedUpdates] = useState<Set<number>>(new Set());

  return (
    <>
      <form
        action={formAction}
        className="contact-form contact-import-form"
        onSubmit={() => {
          setSkippedUpdates(new Set());
          setCompletedUpdates(new Set());
        }}
      >
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
      </form>

      {state.status === "error" && (
        <p className="contact-import-error" role="alert">{state.message}</p>
      )}
      {state.status === "complete" && (
        <div className="contact-import-result">
          <p aria-live="polite" role="status">
            Imported {state.imported} contact{state.imported === 1 ? "" : "s"}; skipped {state.skipped + skippedUpdates.size}.
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
                Important info is missing for {state.warnings.length + state.additionalWarnings} spreadsheet row
                {state.warnings.length + state.additionalWarnings === 1 ? "" : "s"}.
              </p>
              <details>
                <summary>View rows without email or phone</summary>
                <ul>
                  {state.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                </ul>
                {state.additionalWarnings > 0 && (
                  <p>{state.additionalWarnings} more row(s) not shown.</p>
                )}
              </details>
            </div>
          )}
          {state.pendingUpdates.length > 0 && (
            <section className="contact-import-updates" aria-label="Contacts needing update confirmation">
              <p>
                Review the rows below. Each has the same name as a saved contact but different information.
              </p>
              {state.pendingUpdates.map((update) => (
                <article className="contact-import-update" key={update.rowNumber}>
                  <h3>Spreadsheet row {update.rowNumber}</h3>
                  {completedUpdates.has(update.rowNumber) ? (
                    <p className="contact-update-success" role="status">
                      Contact updated from row {update.rowNumber}.
                    </p>
                  ) : skippedUpdates.has(update.rowNumber) ? (
                    <p className="contact-update-skipped" role="status">
                      Row {update.rowNumber} was skipped.
                    </p>
                  ) : (
                    <>
                      <p>Choose which saved contact to update, or skip this row.</p>
                      {update.candidates.map((candidate) => (
                        <ContactUpdateConfirmation
                          candidate={candidate}
                          contact={update.contact}
                          key={candidate.id}
                          onSkip={() =>
                            setSkippedUpdates((rows) => new Set(rows).add(update.rowNumber))
                          }
                          onUpdated={() =>
                            setCompletedUpdates((rows) =>
                              rows.has(update.rowNumber)
                                ? rows
                                : new Set(rows).add(update.rowNumber),
                            )
                          }
                        />
                      ))}
                    </>
                  )}
                </article>
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}
