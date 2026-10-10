# STUDIQ account setup (GitHub Pages + Supabase)

STUDIQ is a static website. GitHub Pages serves the HTML/CSS/JavaScript files, while Supabase provides email/password authentication and a database with Row Level Security (RLS). **The account screen will stay locked until Supabase is configured.**

## 1. Create a Supabase project

1. Open https://supabase.com/ and create a project in your own account.
2. In the project dashboard, open **Project Settings / API** (the exact sidebar grouping may change).
3. Copy the **Project URL** and the **Publishable key**. A legacy `anon` public key is also accepted.
4. Do not use or publish a `service_role` / secret key.

## 2. Create the private data table

1. In the Supabase dashboard, open **SQL Editor**.
2. Open the project file `supabase-setup.sql`, copy all of its contents, paste it in SQL Editor, and run it.
3. The script creates `public.studiq_user_data` and Row Level Security policies. Those policies allow an authenticated account to read/write only the row whose `user_id` matches its own Supabase user ID.
4. Do not disable RLS or add an unrestricted policy to this table.

## 3. Configure the website

Edit `supabase-config.js` and replace the two placeholders:

```js
window.STUDIQ_SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
window.STUDIQ_SUPABASE_PUBLISHABLE_KEY = "YOUR_PUBLISHABLE_OR_ANON_KEY";
```

These are browser-side project details. A publishable/anon key is designed to be public **only when database permissions and RLS policies are correctly configured**. Never place a `service_role` or secret key in this file or in GitHub.

## 4. Configure email confirmation and redirect URLs

1. In Supabase, open **Authentication / URL Configuration**.
2. Set **Site URL** to your actual GitHub Pages URL, for example `https://YOUR_GITHUB_NAME.github.io/studiq/`.
3. Add the exact same URL under the allowed **Redirect URLs**. Replace the example name with your GitHub username and use the repository name actually used in your URL.
4. Keep email confirmation enabled if available. New users then need to confirm their email before signing in. After clicking the confirmation link, return to the STUDIQ page and sign in.

If your repository is a user/organization root site rather than a project site, the URL may not include `/studiq/`; use the exact URL GitHub Pages shows.

## 5. Upload to GitHub Pages

Upload/commit these files into the **root** of the repository (same level):

- `index.html`
- `styles.css`
- `app.js`
- `supabase-config.js`
- `supabase-setup.sql` (setup reference; not executed by GitHub Pages)
- `README.md` and `README_SETUP.md`

In GitHub, open **Settings / Pages** and deploy from branch `main`, folder `/ (root)`. Wait for deployment, open the public Pages URL, and use **Create account**.

## 6. What the login system does

- Signup and sign-in use Supabase Auth with email and password (minimum 8 characters in the STUDIQ form).
- The Supabase browser session is persisted, so the user normally stays signed in in the same browser until signing out or the session is invalidated.
- STUDIQ tasks, notes, habits, schedule, theme, settings, and focus stats are synced to the row for that authenticated user.
- A **Sign out / ออกจากระบบ** button appears in the app. STUDIQ tries to sync before sign-out and clears that account's local cache after a successful save.
- Starter examples are generic school examples and can be edited or deleted.

## 7. Smart Schedule usage

1. Go to **Smart Planner** and add each task. Fill in the due date, estimated duration, subject, and priority.
2. Go to **Smart Schedule**.
3. Set the available start and end times (for example, `16:00` to `19:00`) and break minutes (for example, `10`).
4. Press **บันทึกเวลา / Save time** to save those preferences and generate the schedule, or press **สร้างตารางอัตโนมัติ / Create schedule** after setting/saving the availability.
5. Review the generated schedule. If you add/change tasks or availability, create the schedule again. Export it as PNG or print/save as PDF.

The current scheduler is rule-based: it sorts open tasks by priority and due date, then fits tasks into the time range the user entered. It does not automatically know the student's school timetable unless that time is accounted for in the chosen available range.

## Privacy and limitations

- RLS is what prevents one authenticated account from reading another account's database row. Do not remove the policies in `supabase-setup.sql`.
- Keep the account password private. Sign out on a shared computer and use a device screen lock. Someone who can use an already-unlocked signed-in browser may still see the open website.
- GitHub Pages does not host the authentication database itself; Supabase setup is required for real account isolation and cloud sync.
- This starter project has not undergone a professional security audit. Do not store highly sensitive information in it.
