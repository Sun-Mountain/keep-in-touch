# Keep in Touch

A private contacts app built with Next.js App Router, Prisma 7, PostgreSQL, and Better Auth.

## Get started

1. Install dependencies with `pnpm install`.
2. Start a PostgreSQL server and configure `DATABASE_URL` in `.env` (see `.env.example`).
3. Set `BETTER_AUTH_SECRET` in `.env` to a random secret of at least 32 characters.
4. Create/update the database schema with `pnpm db:migrate`.
5. Start the app with `pnpm dev`.

Open [http://localhost:3000](http://localhost:3000), create an account, and add people to your circle. Email/password authentication is handled by Better Auth, and each contact is scoped to its owner.

## Useful commands

- `pnpm dev` — start the development server
- `pnpm build` — generate Prisma Client and build the app
- `pnpm lint` — lint the project
- `pnpm db:generate` — generate Prisma Client
- `pnpm db:migrate` — create and apply a development migration
- `pnpm db:push` — sync the schema without creating a migration
- `pnpm db:studio` — open Prisma Studio

The example connection string assumes a local PostgreSQL database named `keep_in_touch` with user and password `postgres`. Update it to match your local or hosted PostgreSQL credentials. The Prisma schema uses the PostgreSQL provider.
