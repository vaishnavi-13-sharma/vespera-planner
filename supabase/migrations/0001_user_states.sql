-- Vespera cloud sync: one private board per signed-in person.
-- Run this once in the Supabase dashboard (SQL Editor → New query → paste → Run).

create table if not exists public.user_states (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  -- keep any single board comfortably inside the free tier
  constraint user_states_state_size check (octet_length(state::text) < 2000000)
);

-- The server stamps every write, so devices can tell which version is newer.
create or replace function public.touch_user_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists user_states_touch on public.user_states;
create trigger user_states_touch
  before insert or update on public.user_states
  for each row execute function public.touch_user_states_updated_at();

-- Row-level security: every person can only ever see or change their own board.
alter table public.user_states enable row level security;

drop policy if exists "read own board" on public.user_states;
create policy "read own board" on public.user_states
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "create own board" on public.user_states;
create policy "create own board" on public.user_states
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own board" on public.user_states;
create policy "update own board" on public.user_states
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own board" on public.user_states;
create policy "delete own board" on public.user_states
  for delete to authenticated using (auth.uid() = user_id);

-- Live updates between your devices (Supabase Realtime respects the policies above).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_states'
  ) then
    alter publication supabase_realtime add table public.user_states;
  end if;
end;
$$;
