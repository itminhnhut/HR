# Project notes

## Secrets: never in git

- Turnstile keys (`VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`), the Neon database URL, session secret and
  HR passwords go only into Vercel environment variables and local `.env` / `.env.local` files (git-ignored).
- Never write real keys into code, tests, docs, specs, commit messages or `.env.example` (placeholders only).
- Before every commit, scan the staged diff for keys (`0x4AAA…`, `npg_…`, `postgres://`) and stop if one shows up.
