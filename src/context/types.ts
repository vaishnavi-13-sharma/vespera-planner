// Every data shape in Vespera v2. See docs/superpowers/specs/2026-11-12-living-week-design.md.

/** A local calendar date, "YYYY-MM-DD". */
export type DateKey = string;

/** anchor = locked commitment; focus = deep-work block; flexible = movable life block. */
export type BlockKind = 'anchor' | 'focus' | 'flexible';

export type Accent = 'gold' | 'burgundy' | 'rose' | 'sage' | 'taupe';

/** Fields shared by one-off blocks, series and per-date overrides. */
export interface BlockFields {
  title: string;
  kind: BlockKind;
  /** Minutes since midnight, or null when the block floats ("Flexible", "Early Morning"). */
  start: number | null;
  end: number | null;
  /** Shown instead of a time range when start/end are null. */
  timeLabel?: string;
  accent?: Accent;
  note?: string;
  /** Links the block to a Quest category by its permanent id. */
  categoryId?: string;
}

export interface OneOffBlock extends BlockFields {
  id: string;
  date: DateKey;
  begun?: boolean;
}

export type RepeatRule =
  | { freq: 'daily' }
  | { freq: 'weekdays' }
  /** weekdays: 0 = Sunday … 6 = Saturday. interval: every N weeks. */
  | { freq: 'weekly'; interval: 1 | 2 | 3 | 4; weekdays: number[] }
  /** Same day-of-month as the series startDate; months without that day are skipped. */
  | { freq: 'monthly' };

export interface Series extends BlockFields {
  id: string;
  repeat: RepeatRule;
  startDate: DateKey;
  endDate?: DateKey;
}

/** A per-date override for one occurrence of a series. */
export interface SeriesException {
  skipped?: boolean;
  begun?: boolean;
  overrides?: Partial<BlockFields>;
}

/** Where an occurrence comes from, so edits know what to change. */
export type OccurrenceSource = { type: 'oneoff'; id: string } | { type: 'series'; id: string; date: DateKey };

/** One block as it appears on one date (one-off, or a series expanded with its exception). */
export interface Occurrence extends BlockFields {
  /** Stable per date: the one-off id, or `${seriesId}@${date}`. */
  key: string;
  date: DateKey;
  begun: boolean;
  source: OccurrenceSource;
  repeat: RepeatRule | null;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  accent: Accent;
  blurb?: string;
  archived: boolean;
}

export interface Task {
  id: string;
  title: string;
  categoryId: string;
  done: boolean;
  dueDate?: DateKey;
  /** Set when checked off, cleared when unchecked. */
  completedOn?: DateKey;
}

export interface ChronicleEntry extends Task {
  completedOn: DateKey;
}

/** Chronicle entries older than 90 days, compacted into one summary per month (Wave 3). */
export interface ChronicleMonth {
  /** "YYYY-MM" */
  month: string;
  total: number;
  /** categoryId → quests finished that month. */
  byCategory: Record<string, number>;
  /** Quest titles finished that month, oldest first (titles only: no ids, dates or fields). */
  titles: string[];
}

/** Activity older than 90 days, summed per month (Wave 3). */
export interface ActivityMonth {
  /** "YYYY-MM" */
  month: string;
  quests: number;
  spells: number;
  focusMinutes: number;
  cards: number;
}

export interface NoteTag {
  id: string;
  name: string;
  emoji: string;
  /** Vocab tags render flip cards with a definition. */
  vocab: boolean;
}

export interface Note {
  id: string;
  tagId: string;
  /** Note body, or the word itself on vocab cards. */
  text: string;
  definition?: string;
  /** Vocab cards only: spaced-repetition schedule (step indexes REVIEW_STEPS). */
  review?: { step: number; due: DateKey };
}

export interface Settings {
  /** Minutes since midnight. */
  dayStart: number;
  dayEnd: number;
  /** 0 turns the running-late offer off. */
  lateOfferMinutes: 0 | 5 | 10 | 15;
  focusMinutes: 2 | 5 | 10;
  unstickActions: string[];
  // Delights (Build B)
  sparkles: boolean;
  sounds: boolean;
  /** 0–1 */
  volume: number;
  seasonal: boolean;
  weeklySummary: boolean;
  /** Last choices in the focus chooser. */
  focusRhythm: FocusRhythm;
  focusSound: AmbientSound;
  // Personal Sanctuary (Build E)
  realm: RealmId;
  /** The header sky follows the time of day. */
  skyAtmosphere: boolean;
  signet: Signet;
  fastener: Fastener;
  /** Pressed flower sprigs tucked behind some notes. */
  sprigs: boolean;
  trinket: TrinketKind;
}

export type RealmId = 'velvet' | 'sunlit' | 'moonlit' | 'vintage';
export type SealColor = 'burgundy' | 'gold' | 'rose' | 'sage' | 'moonstone';
export type SealEmblem = 'moon' | 'rose' | 'crown' | 'sword' | 'star' | 'cat' | 'initial';
export interface Signet {
  color: SealColor;
  emblem: SealEmblem;
  /** One uppercase letter A–Z; shown when emblem is 'initial'. */
  initial: string;
}
export type Fastener = 'tacks' | 'bows' | 'washi';
export type TrinketKind = 'cat' | 'vial' | 'jar' | 'none';
export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type CatMood = 'nap' | 'awake' | 'focus';

/** What happened on one day; any non-zero count lights that day's candle. */
export interface DayActivity {
  quests: number;
  spells: number;
  focusMinutes: number;
  cards: number;
}

export type FocusRhythm = 'whole' | 'pomodoro25' | 'pomodoro50';
export type AmbientSound = 'rain' | 'fire' | 'off';

/** A running focus session. Persisted, so it survives a refresh. */
export interface FocusSession {
  title: string;
  categoryId?: string;
  date: DateKey;
  occurrenceKey: string;
  rhythm: FocusRhythm;
  sound: AmbientSound;
  /** Epoch ms. */
  startedAt: number;
  totalMinutes: number;
  /** Epoch ms when paused, or null while running. */
  pausedAt: number | null;
  /** Total ms spent paused before the current pause. */
  pausedMs: number;
}

export type Season = 'autumn' | 'winter' | 'valentine' | 'spring';

export interface FocusVeilSession {
  action: string;
  /** Set when the action came from an open quest in the first category, so finishing it checks that quest off. */
  taskId: string | null;
  endsAt: number;
}

/**
 * save-unreadable: the saved board couldn't be read at all; save-repaired: a few of its items
 * couldn't be read and were left out. Either way the original text is kept (see `unreadableBackupKey`).
 * newer-version: a newer Vespera saved this board; it is open read-only for the session and never written over.
 */
export type Notice = 'migration-failed' | 'import-failed' | 'save-unreadable' | 'save-repaired' | 'newer-version';

export interface VesperaState {
  version: 2;
  blocks: OneOffBlock[];
  series: Series[];
  /** seriesId → date → exception */
  exceptions: Record<string, Record<DateKey, SeriesException>>;
  /** Array order is display order. */
  categories: Category[];
  tasks: Task[];
  chronicle: ChronicleEntry[];
  noteTags: NoteTag[];
  notes: Note[];
  settings: Settings;
  /** Never persisted. */
  focusVeil: FocusVeilSession | null;
  /** Reserved for the Build D Claude assistant. */
  assistant: { panelOpen: boolean };
  lastRolloverDate: DateKey;
  /** Never persisted. */
  notice: Notice | null;
  activity: Record<DateKey, DayActivity>;
  focusSession: FocusSession | null;
  /** Monday of the week whose weekly summary was last dismissed. */
  lastSummaryWeek: DateKey | null;
  /** The last few quick captures, newest first. Never persisted or synced. */
  captureLog: CaptureLogEntry[];
  /** Which board shape wrote this (see src/context/schema.ts). `version: 2` above is the format family. */
  schemaVersion: number;
  /** Chronicle older than 90 days, by month (oldest first). */
  chronicleArchive: ChronicleMonth[];
  /** Activity older than 90 days, by month (oldest first). */
  activityArchive: ActivityMonth[];
}

export interface CaptureLogEntry {
  id: string;
  /** The line as typed. */
  text: string;
  /** What it became, e.g. "Quest · Work · due Fri 13 Nov". */
  summary: string;
  /** Epoch ms. */
  at: number;
}
