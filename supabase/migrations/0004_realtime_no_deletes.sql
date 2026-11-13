-- Never broadcast deletions over Realtime.
-- Supabase Realtime can't apply row-level security or filters to DELETE events, so a deleted row's key
-- (its user_id) reached every signed-in listener; the live check with two throwaway accounts saw it happen
-- (2026-11-12). Vespera only ever listens for inserts and updates, so the publication stops sending deletes.
-- This is publication-wide: user_states is the only table Vespera publishes.
-- Run once in the Supabase dashboard (SQL Editor → New query → paste → Run), after 0003. Safe to run again.
alter publication supabase_realtime set (publish = 'insert, update');
