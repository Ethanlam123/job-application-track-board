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

## Deploy

Static site - any static host works. On Vercel:

```
npx vercel --prod
```

or import the repo at vercel.com/new (framework preset: Other, no build command).
