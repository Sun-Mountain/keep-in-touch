# Keep in Touch

A private contacts app built with Next.js App Router, Prisma 7, PostgreSQL, and Better Auth.

## Get started

1. Install dependencies with `pnpm install`.
2. Start a PostgreSQL server and configure `DATABASE_URL` in `.env` (see `.env.example`).
3. Set `BETTER_AUTH_SECRET` in `.env` to a random secret of at least 32 characters.
4. Create/update the database schema with `pnpm db:migrate`.
5. Start the app with `pnpm dev`.

Open [http://localhost:3000](http://localhost:3000), create an account, and add people to your circle. Email/password authentication is handled by Better Auth, and each contact is scoped to its owner.

## Import contacts

From the dashboard, import an `.xlsx` or `.csv` file, or paste a public/published Google Sheets link. Imports read the first worksheet and expect the headers in the downloadable CSV template. Each row needs a name and a mailing address (street, city, region, and postal code; country is optional). Email and phone are optional; imported contacts without both are marked as missing important info. Birthday values should use `YYYY-MM-DD` or a spreadsheet date cell.

Invalid rows and duplicates are skipped and reported. A row is considered a duplicate when its normalized name and either its email or phone number match an existing contact. Imports are limited to 5,000 rows and 4 MB per spreadsheet.

## Useful commands

- `pnpm dev` — start the development server
- `pnpm build` — generate Prisma Client and build the app
- `pnpm lint` — lint the project
- `pnpm db:generate` — generate Prisma Client
- `pnpm db:migrate` — create and apply a development migration
- `pnpm db:push` — sync the schema without creating a migration
- `pnpm db:studio` — open Prisma Studio

The example connection string assumes a local PostgreSQL database named `keep_in_touch` with user and password `postgres`. Update it to match your local or hosted PostgreSQL credentials. The Prisma schema uses the PostgreSQL provider.
