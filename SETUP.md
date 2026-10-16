# Portal: setup guide

This is a clean copy of the portal's **source code and structure only**. It contains no company
data, no accounts, no passwords, no keys, no git history and no deployment links. Everything
secret or personal is created by you, on your own infrastructure, using the steps below.

## What it is
A Next.js 14 (App Router, TypeScript, Tailwind) internal portal backed by MongoDB (via Prisma):
people directory, attendance and leave, task board, clients, payroll and payslips, announcements,
holidays, an encrypted password vault with approval-based one-time access, Slack notifications,
and an optional MCP server so AI assistants can work with tasks.

## You need
- Node.js 20 or newer and npm
- A MongoDB database that is a **replica set** (MongoDB Atlas free tier works, or `docker compose up`)
- Optional: an email (SMTP) account, an S3 bucket or Supabase for file uploads, a Slack app

## First run (local)
1. `npm install`
2. `cp .env.example .env` and fill in the values. At minimum:
   - `DATABASE_URL`
   - `AUTH_SECRET` and `NEXTAUTH_SECRET` (each from `openssl rand -base64 32`)
   - `NEXTAUTH_URL` (`http://localhost:3000` locally)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters), used once to create the first admin
   - `VAULT_KEY` (from `openssl rand -base64 48`), **before** anyone saves a login in the vault
3. `npx prisma db push` creates the collections and indexes.
4. `npm run seed` creates the first admin and default company settings. There is no default account.
5. `npm run dev`, then open http://localhost:3000 and sign in with the admin you just created.
6. Add people from People Directory, then clients, tasks and so on.

## Tests and build
- `npm test` runs the unit tests (no database needed).
- `npm run build` makes a production build.

## Deploying
- **Vercel:** import the repository as a new project, add the environment variables from `.env.example`
  in the project settings (mark secrets as Sensitive), and deploy. `vercel.json` defines the scheduled job.
- **Your own server:** see `docs/DEPLOY.md` and the `docker-compose*.yml` and `Caddyfile` files.
- Scheduled jobs live under `/api/cron/*` and are protected by `CRON_SECRET`.

## Things to change for your own use
- **Branding:** the product name and logos are in `public/branding/` and in the UI text. Replace them with yours.
- **Company settings:** name, address and payslip footer are editable in Settings → Company Settings.
- **Leave rules and departments:** `src/lib/constants.ts`.

## Security notes
- Never commit `.env`. Use a different `AUTH_SECRET`, `VAULT_KEY` and `CRON_SECRET` in every environment.
- Do not change `VAULT_KEY` or `AUTH_SECRET` after data is saved: encrypted values (vault logins, bank and
  ID numbers) would become unreadable.
- Rotate any token that was ever pasted into chat, email or a screenshot.

## Folder map
- `src/app` pages and API routes
- `src/components`, `src/hooks`, `src/lib` UI, data hooks and business logic (with tests next to the code)
- `prisma/schema.prisma` the data model; `prisma/seed.ts` the first-run seed
- `mcp-server` an optional separate MCP server
- `docs` deployment notes and project rules
