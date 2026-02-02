# TaskApp

Live: https://the-task-app.vercel.app

TaskApp is a personal productivity app that combines task lists, an Eisenhower Matrix, a calendar view, and an AI reminder parser. It turns natural-language reminders into structured tasks and keeps everything organized by priority and list.

## Purpose
- Capture tasks quickly, including natural-language reminders.
- Prioritize using the Eisenhower Matrix (Do First, Schedule, Delegate, Eliminate).
- View tasks on a calendar and subscribe via iCal.

## Key Features
- Task lists with groups
- Eisenhower Matrix view
- Calendar view + iCal feed
- AI reminder parsing (multi-task support)

## Tech Stack
- Next.js (App Router)
- Firebase (Auth + Firestore)
- Azure OpenAI (AI reminder parsing)

## Local Development
1) Install dependencies:
   ```bash
   npm install
   ```
2) Create `.env.local` (see `.env.local.example` for a starting point).
3) Run the dev server:
   ```bash
   npm run dev
   ```

## Environment Variables
Minimum required (local/dev):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Required for Calendar feed API:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Required for AI parsing:
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

## Deployment
You can deploy on any Node-compatible platform (Vercel, Render, Railway, etc.).

### Vercel (recommended)
1) Push the repo to GitHub.
2) Import into Vercel.
3) Add environment variables in Vercel project settings (match `.env.local`).
4) Deploy.

### Generic Node Host
1) Build:
   ```bash
   npm run build
   ```
2) Start:
   ```bash
   npm run start
   ```
3) Configure environment variables on the host.


## Notes
- The AI endpoint uses Azure OpenAI chat completions and expects a valid deployment name.
- Keep API keys private and rotate if exposed.
