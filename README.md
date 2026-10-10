# STUDIQ — Your Personal Learning System

A student productivity website built with HTML, CSS, and JavaScript. It includes Thai/English interface switching, general starter tasks, planner tools, schedule generation, a focus timer, notes, analytics, habit tracking, and six themes.

## Files

- `index.html` — page layout, account sign-in/sign-up screen, and app pages
- `styles.css` — responsive layout, components, and themes
- `app.js` — planner functions, scheduling, language switch, auth, and cloud sync
- `supabase-config.js` — your Supabase project URL and public publishable/anon key placeholders
- `supabase-setup.sql` — create the user-data table and per-account Row Level Security policies
- `README_SETUP.md` — step-by-step configuration instructions

## Important: setup is required for accounts

GitHub Pages is static hosting, so it does not provide a private user database by itself. To enable real sign-up/sign-in, persistent sessions, per-account data, and cloud sync, create a Supabase project, run `supabase-setup.sql` in its SQL Editor, and add the Project URL and publishable/anon key to `supabase-config.js`. Follow `README_SETUP.md` before using it. The app remains locked until configured.

Never put a Supabase `service_role` or secret key in browser files or GitHub. The supplied SQL enables RLS, and its policies must remain enabled for account isolation.

## Smart Schedule

Add tasks in Smart Planner, enter the estimated duration/priority/due date, then open Smart Schedule. Set your available time and break length and press the button to generate a schedule. The current scheduler is rule-based, not an AI model.

## Publish with GitHub Pages

Upload all project files into the repository root, then select **Settings → Pages → Deploy from a branch → `main` → `/ (root)**. Make sure `supabase-config.js` contains your own Supabase project details and that Supabase's allowed redirect URL is the exact deployed Pages URL.
