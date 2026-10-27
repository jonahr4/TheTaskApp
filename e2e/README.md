# E2E tests (Playwright)

Browser end-to-end tests for TheTaskApp web. They drive the real app in
Chromium against the real Firebase backend.

Each authenticated test creates its own email/password user through the
signup form, uses only that user's tasks, and then deletes the user.
Deletion is checked by trying to sign in again and expecting
"Invalid email or password." There is no shared dummy account and no
saved `storageState`.

Logged-out tests (bad password, redirect, signup toggle) do not create
a user.

## Running

The dev server starts automatically and reads Firebase config from
`.env.local`.

```bash
npm run test:e2e
```

Against a deployed preview instead of localhost:

```bash
PLAYWRIGHT_BASE_URL=https://the-task-app.vercel.app npm run test:e2e
```

Install the browser once if needed: `npx playwright install chromium`.

## What is covered

| Spec | Cases |
|---|---|
| `auth.spec.ts` | invalid credentials error, unauthenticated redirect to `/login`, signup-mode toggle, sign out |
| `tasks.spec.ts` | create (title-only and all fields), edit title, complete/uncomplete, delete, title-required validation |
| `auto-urgent.spec.ts` | trigger date passed → becomes urgent ("Do First"); trigger in future → stays; custom day window respected |
| `groups.spec.ts` | create list, assign task to it |
| `matrix.spec.ts` | task appears in its priority quadrant; editing priority moves it |
| `calendar.spec.ts` | dated task renders as a calendar event; clicking opens the editor |

## Test hygiene

- One Firebase account per test (`e2e/fixtures.ts`). Teardown deletes it and verifies sign-in fails.
- Task and list titles are timestamped per run (`uniqueTitle`).
- Each data spec also deletes the tasks it created before the account is removed.
- Workers stay at 1 so signup does not trip Firebase's rate limit. Tests still do not share users.

## CI

`.github/workflows/e2e.yml` runs the suite on manual dispatch
(`workflow_dispatch`). Add these repository secrets before running:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Known limitations (not covered)

- Google OAuth sign-in (popup flow can't be automated).
- Drag-and-drop reordering (hello-pangea DnD is flaky under automation;
  priority changes are asserted through the modal instead).
- Right-click date-cell task creation on the calendar.
- Deleting the Auth user does not delete that user's Firestore documents.
  The auth user itself is removed and cannot sign in.
