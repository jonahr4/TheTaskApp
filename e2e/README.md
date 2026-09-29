# E2E tests (Playwright)

Browser end-to-end tests for TheTaskApp web. They drive the real app in
Chromium against the real Firebase backend, signed in as a **dedicated
dummy account** — never a personal account.

## One-time setup

1. Create (or reuse) a dummy Firebase Auth email/password account in the
   Firebase project the app points at. It only ever touches its own
   per-user task data.
2. Export its credentials (never commit them):

   ```bash
   export E2E_TEST_EMAIL="taskapp-e2e-dummy@example.com"
   export E2E_TEST_PASSWORD="..."
   ```

3. Install browsers once:

   ```bash
   npx playwright install chromium
   ```

## Running

```bash
npm run test:e2e            # local dev server is started automatically
```

Against a deployed preview instead of localhost:

```bash
PLAYWRIGHT_BASE_URL=https://the-task-app.vercel.app npm run test:e2e
```

Useful flags: `--headed` (watch it run), `--debug`, `-g "auto-urgent"`
(run one spec), `--reporter=html`.

## What is covered

| Spec | Cases |
|---|---|
| `auth.spec.ts` | invalid credentials error, unauthenticated redirect to `/login`, signup-mode toggle, sign out |
| `tasks.spec.ts` | create (title-only and all fields), edit title, complete/uncomplete, delete, title-required validation |
| `auto-urgent.spec.ts` | trigger date passed → becomes urgent ("Do First"); trigger in future → stays; custom day window respected |
| `groups.spec.ts` | create list, assign task to it |
| `matrix.spec.ts` | task appears in its priority quadrant; editing priority moves it |
| `calendar.spec.ts` | dated task renders as a calendar event; clicking opens the editor |

Auth runs once (`auth.setup.ts`) and every spec reuses the saved session.

## Test hygiene

- Task/list titles are timestamped per run (`uniqueTitle`) so parallel or
  repeated runs never collide.
- Each spec deletes what it created in `afterEach`; cleanup is best-effort
  so a failing test never cascades.
- The suite runs with a single worker because specs share one dummy
  account backed by Firestore.

## CI

`.github/workflows/e2e.yml` runs the suite on manual dispatch
(`workflow_dispatch`). Add these repository secrets before running:

- `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`

## Known limitations (not covered)

- Google OAuth sign-in (popup flow can't be automated).
- Drag-and-drop reordering (hello-pangea DnD is flaky under automation;
  priority changes are asserted through the modal instead).
- Right-click date-cell task creation on the calendar.
