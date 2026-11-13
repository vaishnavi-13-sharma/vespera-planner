-- Every board records the schema that wrote it, and the database refuses to go backwards.
-- A device still running older Vespera can't overwrite (and so strip) a board written by newer Vespera:
-- its update is refused with SQLSTATE VSP01 "schema downgrade", and the app asks it to reload instead.
-- Run once in the Supabase dashboard (SQL Editor → New query → paste → Run), after 0002. Safe to run again.

alter table public.user_states
  add column if not exists schema_version int not null default 2;

-- The version a board claims (as `schemaVersionOf` in src/context/schema.ts): its `schemaVersion` when that
-- is a whole JSON number, otherwise 2 (boards from before versions existed).
create or replace function public.user_states_schema_version_of(board jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(board->'schemaVersion') = 'number' and board->>'schemaVersion' ~ '^[0-9]{1,9}$'
      then greatest((board->>'schemaVersion')::int, 2)
    else 2
  end;
$$;

-- The server stamps the version on every write, so a client can't claim one its board doesn't carry.
create or replace function public.guard_user_states_schema_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.schema_version := public.user_states_schema_version_of(new.state);
  if tg_op = 'UPDATE' and new.schema_version < old.schema_version then
    raise exception 'schema downgrade' using errcode = 'VSP01';
  end if;
  return new;
end;
$$;

drop trigger if exists user_states_schema_version on public.user_states;
create trigger user_states_schema_version
  before insert or update on public.user_states
  for each row execute function public.guard_user_states_schema_version();

-- Boards newer code wrote before this ran: record their version too (only rows that differ are touched).
update public.user_states
  set schema_version = public.user_states_schema_version_of(state)
  where schema_version <> public.user_states_schema_version_of(state);
