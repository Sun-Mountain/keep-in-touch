# Keep in Touch

A private contacts app built with Next.js App Router, Prisma 7, PostgreSQL, and Better Auth.

## Get started

1. Install dependencies with `pnpm install`.
2. Start a PostgreSQL server and configure `DATABASE_URL` in `.env` (see `.env.example`).
3. Set `BETTER_AUTH_SECRET` in `.env` to a random secret of at least 32 characters.
4. Create/update the database schema with `pnpm db:migrate`.
5. Start the app with `pnpm dev`.

Open [http://localhost:3000](http://localhost:3000), create an account, and add people to your circle. Email/password authentication is handled by Better Auth, and each contact is scoped to its owner. Contacts with the same complete mailing address appear together in a shared card, while each person's details and edit/remove controls remain separate.

## Contact-data encryption

Contact names, email addresses, phone numbers, birthdays, family details, mailing addresses, company names, notes, and last-contact dates are encrypted on the server with AES-256-GCM before being stored in PostgreSQL. The database stores ciphertext and a non-identifying marker instead of those values.

Set `CONTACT_ENCRYPTION_KEY` to a randomly generated, base64-encoded 32-byte key (for example, generate one with `openssl rand -base64 32`). Keep it in a server-side secret manager or an uncommitted `.env` file. Do not use a `NEXT_PUBLIC_` prefix. Every app instance and the backfill command must use the same key. If the key is lost or changed, encrypted contacts cannot be recovered; keep secure backups of it separately from database backups.

After applying the contact-encryption migration and generating the Prisma client, run `pnpm contacts:encrypt` to encrypt existing contact records. The backfill is resumable and skips rows already encrypted. For an existing deployment, prevent writes from old app instances until the backfill is complete; new app code encrypts all writes. Existing database backups made before the backfill may still contain plaintext contact details. Database IDs, ownership, and timestamps remain unencrypted. This protects database copies that are separated from the key, not a compromised app server that can access it.

## Import contacts

From the dashboard, import an `.xlsx` or `.csv` file, or paste a public/published Google Sheets link. Imports read the first worksheet and expect the headers in the downloadable CSV template. Each row needs a name and a mailing address (street, city, region, and postal code; country is optional). Email and phone are optional; imported contacts without both are marked as missing important info. Birthday values should use `YYYY-MM-DD` or a spreadsheet date cell.

Invalid rows and duplicates are skipped and reported. A row is considered a duplicate when its normalized name and either its email or phone number match an existing contact. Imports are limited to 5,000 rows and 4 MB per spreadsheet.

## Contact outreach

Select up to 25 contacts to send separate, personalized update-check emails or open individual drafts in your personal email app. Text messages open as drafts in your device's messaging app, so they use your personal number and are never sent by the server.

To send email through Gmail, create a Google OAuth web client, enable the Gmail API, configure the OAuth consent screen, and add `http://localhost:3000/api/gmail/callback` (or your deployed callback URL) as an authorized redirect URI. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` on the server. Gmail sending uses the `gmail.send` permission; Google's app verification or test-user restrictions may apply. Refresh tokens are encrypted at rest with `CONTACT_ENCRYPTION_KEY`. Disconnecting in the app removes the stored token; you can also revoke access in your Google account settings.

For Proton Mail, the dashboard also supports direct sending through [Proton SMTP](https://proton.me/support/smtp-submission) for paid plans using a custom-domain address. Generate an SMTP token in Proton Mail under **Settings → All settings → IMAP/SMTP → SMTP tokens**, then connect the address and token in the dashboard. The token is encrypted at rest with `CONTACT_ENCRYPTION_KEY`. The app uses Proton's SMTP submission endpoint on port 587; the application server must allow outbound SMTP. Proton SMTP-submitted messages are not end-to-end encrypted. Proton SMTP tokens do not support regular `@proton.me` addresses.

## Useful commands

- `pnpm dev` — start the development server
- `pnpm build` — generate Prisma Client and build the app
- `pnpm lint` — lint the project
- `pnpm test:e2e` — run Playwright tests in development
- `PLAYWRIGHT_ENV=production pnpm test:e2e` — run Playwright tests against a production build
- `pnpm db:generate` — generate Prisma Client
- `pnpm db:migrate` — create and apply a development migration
- `pnpm db:push` — sync the schema without creating a migration
- `pnpm db:studio` — open Prisma Studio

The example connection string assumes a local PostgreSQL database named `keep_in_touch` with user and password `postgres`. Update it to match your local or hosted PostgreSQL credentials. The Prisma schema uses the PostgreSQL provider.

Playwright tests require a separate disposable PostgreSQL database whose name ends in `_e2e`. For example:

```sh
PLAYWRIGHT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/keep_in_touch_e2e" pnpm test:e2e
PLAYWRIGHT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/keep_in_touch_e2e" PLAYWRIGHT_ENV=production pnpm test:e2e
```

The test runner applies migrations to this database and removes its temporary users after each test. It refuses database names that do not end in `_e2e`.
