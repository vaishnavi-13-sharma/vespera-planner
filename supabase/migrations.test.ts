// @vitest-environment node
// Static checks on the SQL migrations (they run in the Supabase dashboard, not here).
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAX_BOARD_BYTES } from '../src/sync/logic';

const dir = resolve(process.cwd(), 'supabase/migrations');
const sql = (name: string) => readFileSync(resolve(dir, name), 'utf8');

describe('supabase migrations', () => {
  it('are numbered in order, without gaps', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    expect(files.map((f) => f.slice(0, 4))).toEqual(files.map((_, i) => String(i + 1).padStart(4, '0')));
  });

  it('pin the trigger function’s search_path (Supabase linter)', () => {
    expect(sql('0002_trigger_search_path.sql')).toMatch(/alter function public\.touch_user_states_updated_at\(\)\s+set search_path = ''/);
  });

  it('keep the server’s size limit in step with the app’s (VB-04)', () => {
    const limit = sql('0001_user_states.sql').match(/octet_length\(state::text\) < (\d+)/)?.[1];
    expect(Number(limit)).toBe(MAX_BOARD_BYTES);
  });
});

describe('0003: the database refuses schema downgrades', () => {
  const m = () => sql('0003_schema_version.sql');

  it('adds schema_version, defaulting to the legacy version 2, and can run twice', () => {
    expect(m()).toMatch(/alter table public\.user_states\s+add column if not exists schema_version int not null default 2/);
    expect(m()).toMatch(/create or replace function public\.guard_user_states_schema_version\(\)/);
    expect(m()).toMatch(/drop trigger if exists user_states_schema_version on public\.user_states/);
  });

  it('derives the version from the board on every write, ignoring a version that isn’t a whole number', () => {
    expect(m()).toMatch(/create trigger user_states_schema_version\s+before insert or update on public\.user_states/);
    expect(m()).toMatch(/new\.schema_version := public\.user_states_schema_version_of\(new\.state\)/);
    // Only a JSON number made of digits is cast (so the cast can't fail); "3.5", "four" or an object count as 2.
    expect(m()).toMatch(/jsonb_typeof\(board->'schemaVersion'\) = 'number' and board->>'schemaVersion' ~ '\^\[0-9\]\{1,9\}\$'/);
    expect(m()).toMatch(/then greatest\(\(board->>'schemaVersion'\)::int, 2\)\s+else 2/);
  });

  it('raises VSP01 “schema downgrade” when an update would lower the version', () => {
    expect(m()).toMatch(/if tg_op = 'UPDATE' and new\.schema_version < old\.schema_version then\s+raise exception 'schema downgrade' using errcode = 'VSP01'/);
  });

  it('pins every function’s search_path, like 0002', () => {
    const functions = m().match(/create or replace function[\s\S]*?\$\$/g) ?? [];
    expect(functions).toHaveLength(2);
    for (const f of functions) expect(f).toMatch(/set search_path = ''/);
  });
});

describe('0004: Realtime never broadcasts deletions', () => {
  it('limits the publication to inserts and updates (DELETE events bypass RLS and filters)', () => {
    expect(sql('0004_realtime_no_deletes.sql')).toMatch(/alter publication supabase_realtime set \(publish = 'insert, update'\);/);
  });
});
