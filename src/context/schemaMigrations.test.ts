import { LEGACY_SCHEMA_VERSION, SCHEMA_VERSION } from './schema';
import { MIGRATIONS, migrateStored } from './schemaMigrations';
import { createSeedState } from '../test/ownerWeek';

type Obj = Record<string, unknown>;

/** The owner's board as saved before Wave 3: no schemaVersion, no archives. */
function legacyBoard(edit: (s: Obj) => void = () => {}): Obj {
  const { schemaVersion: _v, chronicleArchive: _c, activityArchive: _a, ...legacy } = JSON.parse(JSON.stringify(createSeedState()));
  edit(legacy);
  return legacy;
}

describe('migrateStored', () => {
  it('has a step from every older version up to the current one', () => {
    for (let v = LEGACY_SCHEMA_VERSION; v < SCHEMA_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function');
  });

  it('upgrades a v2 board to v3 by adding the version and empty archives, keeping everything else', () => {
    const legacy = legacyBoard();
    const migrated = migrateStored(legacy) as Obj;
    expect(migrated).toEqual({ ...legacy, schemaVersion: 3, chronicleArchive: [], activityArchive: [] });
  });

  it('does not change the board it is given', () => {
    const legacy = legacyBoard();
    const copy = structuredClone(legacy);
    migrateStored(legacy);
    expect(legacy).toEqual(copy);
  });

  it('leaves current boards, boards from the future and non-boards alone', () => {
    const current = { ...legacyBoard(), schemaVersion: SCHEMA_VERSION };
    expect(migrateStored(current)).toBe(current);
    const future = { ...legacyBoard(), schemaVersion: SCHEMA_VERSION + 1, somethingNew: [1] };
    expect(migrateStored(future)).toBe(future);
    for (const odd of [null, 'x', 7, [1]]) expect(migrateStored(odd)).toBe(odd);
  });

  it('runs every step in order, each from its own version', () => {
    const seen: number[] = [];
    const step = (from: number) => (raw: Obj) => {
      seen.push(from);
      expect(raw.schemaVersion ?? LEGACY_SCHEMA_VERSION).toBe(from);
      return { ...raw, [`v${from + 1}`]: true };
    };
    const migrated = migrateStored({ version: 2 }, { to: 5, migrations: { 2: step(2), 3: step(3), 4: step(4) } }) as Obj;
    expect(seen).toEqual([2, 3, 4]);
    expect(migrated).toEqual({ version: 2, v3: true, v4: true, v5: true, schemaVersion: 5 });
  });

  it('refuses (throws) rather than skip a missing step', () => {
    expect(() => migrateStored({ version: 2 }, { to: 4, migrations: { 2: (r) => r } })).toThrow();
  });

  it('keeps archives a v2 board somehow already has', () => {
    const archive = [{ month: '2026-01', total: 1, byCategory: {}, titles: ['x'] }];
    expect(migrateStored(legacyBoard((s) => (s.chronicleArchive = archive)))).toMatchObject({ chronicleArchive: archive });
  });

  it('compacts the Chronicle and activity older than 90 days before the board’s last rollover', () => {
    const migrated = migrateStored(
      legacyBoard((s) => {
        s.lastRolloverDate = '2026-11-12';
        s.chronicle = [
          { id: 'c-new', title: 'Recent', categoryId: 'cat-reset', done: true, completedOn: '2026-08-14' }, // exactly 90 days: stays
          { id: 'c-old', title: 'Old', categoryId: 'cat-reset', done: true, completedOn: '2026-08-13' },
        ];
        s.activity = { '2026-08-14': { quests: 1, spells: 0, focusMinutes: 0, cards: 0 }, '2026-08-13': { quests: 2, spells: 1, focusMinutes: 5, cards: 0 } };
      }),
    ) as Obj;
    expect((migrated.chronicle as Obj[]).map((c) => c.id)).toEqual(['c-new']);
    expect(migrated.chronicleArchive).toEqual([{ month: '2026-08', total: 1, byCategory: { 'cat-reset': 1 }, titles: ['Old'] }]);
    expect(Object.keys(migrated.activity as Obj)).toEqual(['2026-08-14']);
    expect(migrated.activityArchive).toEqual([{ month: '2026-08', quests: 2, spells: 1, focusMinutes: 5, cards: 0 }]);
  });

  it('leaves entries it cannot read for the sanitizer, and skips compaction without a rollover date', () => {
    const odd = { id: 'c-odd', title: 7, categoryId: 'cat-reset', done: true, completedOn: '2020-01-01' };
    const migrated = migrateStored(legacyBoard((s) => (s.chronicle = [odd, 'x']))) as Obj;
    expect(migrated.chronicle).toEqual([odd, 'x']);
    const old = { id: 'c', title: 'T', categoryId: 'cat-reset', done: true, completedOn: '2020-01-01' };
    const undated = migrateStored(legacyBoard((s) => ((s.chronicle = [old]), (s.lastRolloverDate = 'soon')))) as Obj;
    expect(undated.chronicle).toEqual([old]);
    expect(undated.schemaVersion).toBe(3);
  });
});
