# Nook Studios CMS

This repository contains the Nook Studios public website and a Supabase-backed CMS at `/admin`.
The old Framer export has been replaced with reusable React sections so content is rendered once,
from published database rows, instead of being patched through DOM selectors.

## Local development

```bash
npm install
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Build and typecheck:

```bash
npm run build
npm run typecheck
```

## Supabase setup

The migration in `supabase/migrations/20260924000000_nook_cms.sql` creates:

- `profiles` with `admin`, `editor`, and `viewer` roles
- `sites`, `pages`, `sections`, and `section_items`
- `navigation_items`
- `media_assets`
- `revisions` for draft snapshots
- `site_settings`
- the public `site-assets` Storage bucket
- Row Level Security policies for public reads and staff writes

Apply the migration through the Supabase SQL editor or Supabase CLI. It seeds the homepage,
About, Works, Services, and Contact pages, current navigation, the five requested team members,
logo marquee content, and local approved image paths.

After the first user signs up through Supabase Auth, promote that account to admin from the
Supabase SQL editor:

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

Do not put a service role key in this app. Only the publishable/anon key belongs in
`VITE_SUPABASE_ANON_KEY`.

## Routes

Public:

- `/`
- `/about`
- `/works`
- `/services`
- `/contact`

CMS:

- `/admin/login`
- `/admin/dashboard`
- `/admin/pages`
- `/admin/pages/:pageId`
- `/admin/navigation`
- `/admin/media`
- `/admin/settings`

Only authenticated `admin` and `editor` profiles can enter the CMS. Admins additionally manage
navigation and global settings. Draft snapshots are stored in `revisions`; the public frontend
continues reading the published `sections` rows until Publish is clicked.

## Deployment

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel/Replit deployment environment,
then deploy the Vite build. No database secret is required in the browser.