-- Run this in the Supabase SQL editor for your project.

create table public.profiles (
  id              uuid references auth.users(id) on delete cascade primary key,
  display_name    text,
  fpl_manager_id  integer unique,
  created_at      timestamp with time zone default now()
);

alter table public.profiles enable row level security;

-- Anyone can read all profiles (needed for showing names in standings/picks)
create policy "profiles_select_all" on public.profiles
  for select using (true);

-- Users can only insert/update their own row
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
