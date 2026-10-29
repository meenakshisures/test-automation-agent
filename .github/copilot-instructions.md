# Repo instructions (GitHub Copilot)

This repo is a Playwright (TypeScript) test-automation POC for the Meiden Switchgear dashboard.
Pipeline: `inputs/` -> `ir/*.json` -> `app-model/` Page Objects -> `tests/*.spec.ts` -> `reports/`.
Use the `test-author` custom agent for generating tests; skills live in `.github/skills/`.

## Conventions
- Tests import `{ test, expect }` from `./fixtures` (restores sessionStorage for the SSO session).
  Only specs that test the signed-out experience import from `@playwright/test` and set
  `test.use({ storageState: { cookies: [], origins: [] } })`.
- Tests drive Page Objects in `app-model/pages/`; no raw selectors in specs.
- The app has no `data-test` attributes: use `getByRole` / `getByLabel` / `getByText`.
- Never use `waitForTimeout`; rely on web-first assertions.
- The app shows an auth-bootstrap spinner for 10-15s after load, so a Page Object `goto()` must
  wait for its first heading with `{ timeout: 45_000 }`.
- Every IR `expected` entry needs at least one `expect()`.

## Auth
Sign-in is Microsoft Entra ID SSO, handled once by `tests/auth.setup.ts` -> `auth/microsoft-login.ts`
and saved to `.auth/`. MFA: set `MFA_TOTP_SECRET` in `.env` (automatic) or run headed and approve
manually. Credentials come from `.env` (`TEST_USERNAME`, `TEST_PASSWORD`); never hard-code them.

## Commands
`npm run agent` (parse + test + report) · `npm test` · `npm run test:headed` · `npm run report:open`
· `npx tsc --noEmit` (must pass before running specs).
