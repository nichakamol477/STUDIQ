-- STUDIQ account data: a signed-in user can access only their own row.
-- Run this entire script in Supabase Dashboard > SQL Editor.

create table if not exists public.studiq_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.studiq_user_data enable row level security;

revoke all on table public.studiq_user_data from anon;
grant select, insert, update, delete on table public.studiq_user_data to authenticated;

drop policy if exists "Users can read their own STUDIQ data" on public.studiq_user_data;
drop policy if exists "Users can create their own STUDIQ data" on public.studiq_user_data;
drop policy if exists "Users can update their own STUDIQ data" on public.studiq_user_data;
drop policy if exists "Users can delete their own STUDIQ data" on public.studiq_user_data;

create policy "Users can read their own STUDIQ data"
on public.studiq_user_data
for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create their own STUDIQ data"
on public.studiq_user_data
for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own STUDIQ data"
on public.studiq_user_data
for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete their own STUDIQ data"
on public.studiq_user_data
for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
