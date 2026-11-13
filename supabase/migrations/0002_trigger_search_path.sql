-- Pin the trigger function's search_path (Supabase linter: function_search_path_mutable).
-- With an empty search_path nothing in it can be shadowed by objects in another schema;
-- clock_timestamp() still resolves, because pg_catalog is always searched.
-- Run once in the Supabase dashboard (SQL Editor → New query → paste → Run), after 0001.

alter function public.touch_user_states_updated_at() set search_path = '';
