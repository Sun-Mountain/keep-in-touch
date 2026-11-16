export const MAX_OUTREACH_RECIPIENTS = 25;

export const DEFAULT_OUTREACH_SUBJECT = "Are your contact details up to date?";

export const DEFAULT_OUTREACH_MESSAGE = `Hi {{name}},

I'm checking whether I have your current contact information. Is what I have for you still up to date? Let me know if anything has changed.

Thanks!`;

/** @param {string} template @param {string} name */
export function renderOutreachTemplate(template, name) {
  return template.replace(/\{\{\s*name\s*\}\}/gi, () => name);
}
