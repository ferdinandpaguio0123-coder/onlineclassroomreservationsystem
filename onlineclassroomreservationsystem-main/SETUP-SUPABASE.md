# ClassReserve: Supabase connection setup

This project is a static HTML/CSS/JavaScript site. The Supabase browser client is loaded from esm.sh.

## 1. Add the browser-safe Supabase values

Open `supabase-config.js` and replace:

- `PASTE_YOUR_PROJECT_URL_HERE` with the Project URL from Supabase.
- `PASTE_YOUR_SB_PUBLISHABLE_KEY_HERE` with the `sb_publishable_...` Publishable key.

Do not use a `service_role` key or any secret key in this file. A Supabase publishable key is intended for browser use when Row Level Security is correctly configured.

## 2. Supabase account login

The login form now uses the email address and password for each account in Supabase Authentication. The matching `public.profiles` row supplies the displayed username and role.

## 3. Database expectations

The code expects:

- `public.profiles`: `id`, `username`, `role`
- `public.reservations`: `id`, `user_id`, `username`, `role`, `classroom`, `reservation_date`, `reservation_time`, `status`, `created_at`

The `user_id` column must reference `auth.users(id)`. Row Level Security must allow a user to select their own reservations, Admin to select all reservations, Student/Faculty to insert their own Pending reservations, and Admin to update reservation status.

## 4. Deploy

Commit and push these updated files to GitHub. Vercel should redeploy the connected repository automatically. If it does not, open the Vercel project and redeploy the latest deployment.

## 5. Test

Test each account using its Supabase email and password. Submit a test reservation using Student or Faculty, then sign in as Admin and open Reservations. Admin should see the request and be able to change its status.
