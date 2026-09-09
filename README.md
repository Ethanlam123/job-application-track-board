# Pipeline - Job Application Tracker

Kanban board for tracking job applications from wishlist to offer. Static single-page app (no build step), Supabase for auth and Postgres, deployed on Vercel.

## Stack

- `index.html` + `app.js` - vanilla HTML/CSS/JS, design from the original handoff export
- Supabase - email/password auth, `applications` table with row level security
- `config.js` - project URL + publishable key (safe to expose; RLS protects the data)

## Setup

1. Supabase project: run `schema.sql` in the SQL editor.
2. `config.js` already points at the project; no environment variables needed.

## Demo account

`demo@pipeline.app` / `demo1234`. The demo board seeds itself with sample
applications when empty, and "Clear board" restores the sample data for the
demo account only.

## Features

- Kanban board with drag-and-drop between five stages, synced in realtime
  across tabs and devices (Supabase realtime; RLS-scoped)
- Search across company, role, notes, and location
- "Due soon" strip: overdue and next-7-day deadlines above the board
- Undo-able delete (5s toast)
- Password reset by email ("Forgot password?"); recovery links land on a
  choose-a-new-password screen
- Google sign-in (enable the Google provider in Supabase Auth and add the
  site URL to the redirect allowlist first)
- CSV export (Settings > Data)
- Snapshot funnel stats: active applications, interview rate, offer rate

## Weekly deadline digest (optional)

`supabase/functions/digest-weekly` emails every user their deadlines for the
next 7 days. To enable:

1. `supabase secrets set RESEND_API_KEY=re_xxx` (and optionally
   `DIGEST_FROM_EMAIL="Pipeline <digest@yourdomain.com>"`)
2. Paste your service key into `supabase/cron.sql` and run it in the SQL
   editor (schedules Monday 08:00 UTC)

## Deploy

Static site - any static host works. On Vercel:

```
npx vercel --prod
```

or import the repo at vercel.com/new (framework preset: Other, no build command).
