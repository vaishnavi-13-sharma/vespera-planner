// Quick capture (Build D): one typed line becomes a block, quest, note, vocab card or slide. Free, offline, no AI.
import { addDays, calendarDate, formatDateKey, formatRange, parseDateKey, weekdayOf } from './dates';
import { canShift, describeRepeat, occurrencesForDate } from './recurrence';
import { visibleCategories } from './selectors';
import type { Category, DateKey, RepeatRule, SeriesException, VesperaState } from './types';

export type CaptureIntent =
  | { kind: 'block'; title: string; date: DateKey; start: number; end: number; categoryId?: string; repeat?: RepeatRule }
  | { kind: 'quest'; title: string; categoryId: string; dueDate?: DateKey; guessed?: boolean }
  | { kind: 'note'; text: string; tagId: string }
  | { kind: 'vocab'; word: string; definition: string; tagId: string }
  | { kind: 'slide'; minutes: number; date: DateKey; occurrenceKey: string; label: string }
  | { kind: 'unknown'; text: string; reason: string };

export interface ParsedLine {
  line: string;
  intent: CaptureIntent;
}

/** What a slide changed, so Undo can put every moved block back exactly. */
export interface SlideRestore {
  date: DateKey;
  occurrenceKey: string;
  minutes: number;
  /** Previous times of the one-off blocks that moved. */
  blocks: { id: string; start: number | null; end: number | null }[];
  /**
   * For each repeating block that moved: the slid date's previous start/end overrides only
   * (keyed by that date; null when there were none), so Undo leaves every other edit alone.
   */
  series: { seriesId: string; exceptions: Record<DateKey, SeriesException> | null }[];
}

/** Everything one capture created or moved; `undoCapture` reverses it. */
export interface CaptureReceipt {
  id: string;
  count: number;
  blockIds: string[];
  seriesIds: string[];
  taskIds: string[];
  noteIds: string[];
  slides: SlideRestore[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)';
const WEEKDAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const NAMED_TIMES: Record<string, number> = { morning: 9 * 60, afternoon: 14 * 60, evening: 18 * 60, tonight: 20 * 60, noon: 12 * 60, midnight: 0 };
const CONNECTORS = /^(?:on|at|by|due|from|for|to|in|and)$/i;
const MAX_SLIDE = 240;
/** "quest: …", "add quest: …", "new quest: …" and friends. */
const QUEST_WORDS = ['quest', 'q', 'todo', 'add', 'add quest', 'new quest'];
/** "note: …", "pin note: …", "pin: …", "add note: …": a note under the first non-vocab tag. */
const NOTE_WORDS = ['note', 'pin', 'pin note', 'add note'];
/** "Block 2pm–3pm Deep Focus": a leading "block" (or "add block") before a time is left out of the title. */
const BLOCK_LEAD = /^(?:add\s+)?block\b\s*:?\s*(.+)$/i;

const weekdayOfWord = (word: string) => WEEKDAY_INDEX[word.slice(0, 3).toLowerCase()];

/** The first date on or after `from` that falls on `weekday`. */
function nextWeekday(from: DateKey, weekday: number): DateKey {
  return addDays(from, (weekday - weekdayOf(from) + 7) % 7);
}

/** A time or date that can't exist; the message is what the preview shows. */
class Impossible extends Error {
  constructor(message = 'That time doesn’t exist') {
    super(message);
  }
}

/** Minutes since midnight for an hour/minute/meridiem, guessing am/pm for a bare hour (1–6 → pm). */
function toMinutes(hourText: string, minuteText: string | undefined, meridiem: string | undefined, guess = true): number {
  const hour = Number(hourText);
  const minute = minuteText ? Number(minuteText) : 0;
  if (minute > 59) throw new Impossible();
  if (meridiem) {
    if (hour < 1 || hour > 12) throw new Impossible();
    return ((hour % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0)) * 60 + minute;
  }
  if (hour > 23) throw new Impossible();
  if (hour >= 13 || hour === 0 || !guess) return hour * 60 + minute;
  return (hour <= 6 ? hour + 12 : hour) * 60 + minute;
}

/**
 * Cuts matched spans out of the line, keeping the rest for the title. Runs of whitespace become one space,
 * so a pasted gap can't make the patterns below backtrack through it (CG-10); titles join words with one space anyway.
 */
class Line {
  text: string;
  constructor(text: string) {
    this.text = ` ${text.replace(/\s+/g, ' ')} `;
  }
  take(re: RegExp): RegExpMatchArray | null {
    const m = this.text.match(re);
    if (m && m.index !== undefined) this.text = `${this.text.slice(0, m.index)} ${this.text.slice(m.index + m[0].length)}`;
    return m;
  }
  rest(): string {
    const words = this.text.trim().split(/\s+/).filter(Boolean);
    while (words.length && CONNECTORS.test(words[0])) words.shift();
    while (words.length && CONNECTORS.test(words[words.length - 1])) words.pop();
    return words.join(' ');
  }
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function findCategory(state: VesperaState, word: string): Category | undefined {
  const w = word.toLowerCase();
  return visibleCategories(state.categories).find((c) => c.name.toLowerCase().startsWith(w));
}

function categoryFromTitle(state: VesperaState, title: string): Category | undefined {
  const words = new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  return visibleCategories(state.categories).find((c) => {
    const first = c.name.toLowerCase().split(/[^a-z0-9]+/).find(Boolean);
    return !!first && words.has(first);
  });
}

/** Reads (and removes) a date word. `weekday` is set when the date came from a bare weekday name. */
function takeDate(line: Line, today: DateKey): { date: DateKey; weekday: boolean; tonight: boolean } | null {
  if (line.take(/\btonight\b/i)) return { date: today, weekday: false, tonight: true };
  if (line.take(/\btoday\b/i)) return { date: today, weekday: false, tonight: false };
  if (line.take(/\b(?:tomorrow|tmrw|tmr)\b/i)) return { date: addDays(today, 1), weekday: false, tonight: false };
  let m = line.take(new RegExp(`\\bnext\\s+${WEEKDAY_RE}\\b`, 'i'));
  if (m) return { date: addDays(nextWeekday(today, weekdayOfWord(m[1])), 7), weekday: false, tonight: false };
  m = line.take(new RegExp(`\\b${WEEKDAY_RE}\\b`, 'i'));
  if (m) return { date: nextWeekday(today, weekdayOfWord(m[1])), weekday: true, tonight: false };
  const year = parseDateKey(today).getFullYear();
  // The next time this month and day comes round. 2000 was a leap year, so only Feb 29 waits years for its turn.
  const dated = (month: number, day: number) => {
    if (!calendarDate(2000, month, day)) throw new Impossible('That date doesn’t exist');
    for (let y = year; ; y++) {
      const key = calendarDate(y, month, day);
      if (key && key >= today) return { date: key, weekday: false, tonight: false };
    }
  };
  m = line.take(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) return dated(Number(m[1]) - 1, Number(m[2]));
  m = line.take(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
  if (m) return dated(MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), Number(m[2]));
  m = line.take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\b`, 'i'));
  if (m) return dated(MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), Number(m[1]));
  return null;
}

function takeRepeat(line: Line): RepeatRule | null {
  if (line.take(/\b(?:every\s+day|daily)\b/i)) return { freq: 'daily' };
  if (line.take(/\b(?:every\s+)?weekdays\b/i)) return { freq: 'weekdays' };
  const m = line.take(new RegExp(`\\bevery\\s+(${WEEKDAY_RE}(?:\\s*(?:,|and|&)?\\s*${WEEKDAY_RE})*)\\b`, 'i'));
  if (!m) return null;
  const days = [...new Set(m[1].split(/[\s,&]+|and/i).filter(Boolean).map(weekdayOfWord).filter((d) => d !== undefined))].sort((a, b) => a - b);
  return { freq: 'weekly', interval: 1, weekdays: days };
}

/** Minutes from "30m", "1h", "1.5h", "90 min" (optionally after "for"). */
function takeDuration(line: Line): number | null {
  const m = line.take(/\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(h|hrs?|hours?|m|mins?|minutes?)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Math.round(m[2].toLowerCase().startsWith('h') ? n * 60 : n);
}

/** Reads a time range or a single start time. Bare number ranges count only when `allowBare`. */
function takeTime(line: Line, allowBare: boolean): { start: number; end?: number } | null {
  const T = '(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?';
  const range = line.text.match(new RegExp(`(?<![\\d:/])${T}\\s*(?:-|–|—|to)\\s*${T}(?![\\d/])`, 'i'));
  if (range) {
    const [, h1, m1, ap1, h2, m2, ap2] = range;
    const marked = !!(ap1 || ap2 || m1 || m2);
    if (marked || allowBare) {
      line.take(new RegExp(range[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      let start: number;
      let end: number;
      if (!ap1 && ap2) {
        start = toMinutes(h1, m1, ap2);
        end = toMinutes(h2, m2, ap2);
        if (start > end) start = toMinutes(h1, m1, ap2.toLowerCase() === 'pm' ? 'am' : 'pm');
      } else {
        start = toMinutes(h1, m1, ap1);
        end = toMinutes(h2, m2, ap2, !ap1);
        if (!ap2 && end <= start && end < 12 * 60) end += 12 * 60;
      }
      if (end <= start) throw new Impossible();
      return { start, end };
    }
  }
  let m = line.take(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m) return { start: toMinutes(m[1], m[2], m[3]) };
  m = line.take(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i);
  if (m) return { start: toMinutes(m[1], m[2], undefined) };
  m = line.take(/(?<![\d/])\b(\d{1,2}):(\d{2})\b/);
  if (m) return { start: toMinutes(m[1], m[2], undefined) };
  m = line.take(/\b(noon|midnight|morning|afternoon|evening)\b/i);
  if (m) return { start: NAMED_TIMES[m[1].toLowerCase()] };
  return null;
}

const unknown = (text: string, reason: string): CaptureIntent => ({ kind: 'unknown', text, reason });

function parseSlide(rest: string, original: string, state: VesperaState, today: DateKey, now: number): CaptureIntent {
  const line = new Line(rest);
  const minutes = takeDuration(line);
  if (minutes === null) return unknown(original, 'Say how long, like "slide evening 30m"');
  if (minutes < 5 || minutes > MAX_SLIDE) return unknown(original, 'Slides can be 5 minutes to 4 hours');
  const target = line.rest().toLowerCase();
  const day = occurrencesForDate(state, today);
  const movable = day
    .filter((o): o is typeof o & { start: number; end: number } => o.start !== null && o.end !== null && o.kind !== 'anchor' && o.end > now)
    .sort((a, b) => a.start - b.start);
  const windows: Record<string, [number, number]> = { morning: [0, 12 * 60], afternoon: [12 * 60, 17 * 60], evening: [17 * 60, 24 * 60] };
  let pick: (typeof movable)[number] | undefined;
  let label: string;
  if (!target || target === 'rest' || target === 'everything' || target === 'all') {
    pick = movable[0];
    label = 'the rest of today';
  } else if (windows[target]) {
    const [from, to] = windows[target];
    pick = movable.find((o) => o.start >= from && o.start < to);
    label = target;
  } else {
    pick = movable.find((o) => o.title.toLowerCase().includes(target));
    label = pick?.title ?? target;
  }
  if (!pick) return unknown(original, 'Nothing left to slide today');
  if (!canShift(day, pick.key, minutes)) return unknown(original, 'Blocks can’t run past midnight');
  return { kind: 'slide', minutes, date: today, occurrenceKey: pick.key, label };
}

/** One line → one intent, or null for a blank line. */
export function parseCapture(raw: string, state: VesperaState, today: DateKey, nowMinutes: number): CaptureIntent | null {
  const text = raw.trim();
  if (!text) return null;
  const tags = state.noteTags;
  const firstNoteTag = tags.find((t) => !t.vocab);
  const vocabTag = tags.find((t) => t.vocab);
  const categories = visibleCategories(state.categories);

  try {
    const slide = text.match(/^(?:slide|push)\b\s*(.*)$/i);
    if (slide) return parseSlide(slide[1], text, state, today, nowMinutes);

    const lead = text.match(BLOCK_LEAD);
    if (lead) {
      // Only when a time follows: "block out the weekend" stays a quest.
      const block = parseQuestOrBlock(lead[1], text, state, today, nowMinutes, categories, 'block');
      if (block) return block;
    }

    const prefixed = text.match(/^([a-z][a-z &'-]{0,30}?)\s*:\s*(.*)$/i);
    if (prefixed) {
      const prefix = prefixed[1].trim().replace(/\s+/g, ' ').toLowerCase();
      const body = prefixed[2].trim();
      const tag = tags.find((t) => t.name.toLowerCase() === prefix);
      const kind = QUEST_WORDS.includes(prefix)
        ? 'quest'
        : ['vocab', 'word'].includes(prefix) || tag?.vocab
          ? 'vocab'
          : NOTE_WORDS.includes(prefix) || tag
            ? 'note'
            : null;
      if (kind && !body) return unknown(text, `Add something after "${prefixed[1].trim()}:"`);
      if (kind === 'vocab') {
        const tagId = (tag?.vocab ? tag : vocabTag)?.id;
        if (!tagId) return unknown(text, 'There’s no vocab tag on the Pinboard');
        // (?<!\s): try the dash only from the start of a gap, so a long gap is scanned once, not once per space.
        const [word, ...definition] = body.split(/(?<!\s)\s+[-–—]\s+|:\s+/);
        return { kind: 'vocab', word: word.trim(), definition: definition.join(' – ').trim(), tagId };
      }
      if (kind === 'note') {
        const tagId = (tag ?? firstNoteTag)?.id;
        if (!tagId) return unknown(text, 'There’s no Pinboard tag for notes');
        return { kind: 'note', text: body, tagId };
      }
      if (kind === 'quest') return parseQuestOrBlock(body, text, state, today, nowMinutes, categories, 'quest');
    }
    return parseQuestOrBlock(text, text, state, today, nowMinutes, categories, 'any');
  } catch (e) {
    if (e instanceof Impossible) return unknown(text, e.message);
    throw e;
  }
}

/** 'quest': a quest whatever the line says; 'block': a block, or null when no time is given; 'any': whichever it reads as. */
type ReadAs = 'any' | 'quest' | 'block';

function parseQuestOrBlock(body: string, original: string, state: VesperaState, today: DateKey, now: number, categories: Category[], as: 'block'): CaptureIntent | null;
function parseQuestOrBlock(body: string, original: string, state: VesperaState, today: DateKey, now: number, categories: Category[], as: 'any' | 'quest'): CaptureIntent;
function parseQuestOrBlock(
  body: string,
  original: string,
  state: VesperaState,
  today: DateKey,
  now: number,
  categories: Category[],
  as: ReadAs,
): CaptureIntent | null {
  const line = new Line(body);
  const hash = line.take(/(?:^|\s)#([\p{L}\d][\p{L}\d-]*)/u);
  const hashCategory = hash ? findCategory(state, hash[1]) : undefined;

  if (as === 'quest') {
    const date = takeDate(line, today);
    const title = capitalize(line.rest());
    if (!title) return unknown(original, 'Give the quest a name');
    const categoryId = (hashCategory ?? categories[0])?.id;
    if (!categoryId) return unknown(original, 'There’s no quest category to put it in');
    return { kind: 'quest', title, categoryId, ...(date ? { dueDate: date.date } : {}) };
  }

  const repeat = takeRepeat(line);
  const date = takeDate(line, today);
  const time = takeTime(line, as === 'block' || !!(repeat || date));
  const duration = takeDuration(line);
  let start = time?.start;
  let end = time?.end;
  if (start === undefined && date?.tonight) start = NAMED_TIMES.tonight;

  if (start !== undefined) {
    if (end === undefined) end = start + (duration ?? 60);
    if (end > 24 * 60) return unknown(original, 'Blocks can’t run past midnight');
    const title = capitalize(line.rest());
    if (!title) return unknown(original, 'Give the block a name');
    let blockDate = date?.date ?? today;
    if (repeat) blockDate = firstRepeatDate(repeat, date?.date ?? today);
    else if (date?.weekday && blockDate === today && end <= now) blockDate = addDays(blockDate, 7);
    const category = hashCategory ?? categoryFromTitle(state, title);
    return {
      kind: 'block',
      title,
      date: blockDate,
      start,
      end,
      ...(category ? { categoryId: category.id } : {}),
      ...(repeat ? { repeat } : {}),
    };
  }
  if (as === 'block') return null;

  const title = capitalize(line.rest());
  if (!title) return unknown(original, 'Give the quest a name');
  const categoryId = (hashCategory ?? categories[0])?.id;
  if (!categoryId) return unknown(original, 'There’s no quest category to put it in');
  const guessed = !date && !hash;
  return { kind: 'quest', title, categoryId, ...(date ? { dueDate: date.date } : {}), ...(guessed ? { guessed: true } : {}) };
}

function firstRepeatDate(rule: RepeatRule, from: DateKey): DateKey {
  for (let i = 0; i < 14; i++) {
    const d = addDays(from, i);
    const wd = weekdayOf(d);
    if (rule.freq === 'daily' || rule.freq === 'monthly') return d;
    if (rule.freq === 'weekdays' && wd >= 1 && wd <= 5) return d;
    if (rule.freq === 'weekly' && rule.weekdays.includes(wd)) return d;
  }
  return from;
}

/** Every non-blank line with its reading; a pasted list captures several things. */
export function parseCaptures(text: string, state: VesperaState, today: DateKey, nowMinutes: number): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const intent = parseCapture(raw, state, today, nowMinutes);
    if (intent) out.push({ line: raw.trim(), intent });
  }
  return out;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateLabel = (d: DateKey) => `${formatDateKey(d, 'tab')} ${MONTH_SHORT[parseDateKey(d).getMonth()]}`;

/** A one-line preview, e.g. "Block · Fri 13 Nov · 3:00 PM – 5:00 PM · Study". */
export function describeIntent(intent: CaptureIntent, state: VesperaState): string {
  const categoryName = (id?: string) => state.categories.find((c) => c.id === id)?.name;
  switch (intent.kind) {
    case 'block': {
      const parts = ['Block', dateLabel(intent.date), formatRange(intent)];
      const name = categoryName(intent.categoryId);
      if (name) parts.push(name);
      if (intent.repeat) parts.push(describeRepeat(intent.repeat, intent.date));
      return parts.join(' · ');
    }
    case 'quest': {
      const parts = ['Quest', categoryName(intent.categoryId) ?? 'Quests'];
      if (intent.dueDate) parts.push(`due ${dateLabel(intent.dueDate)}`);
      return parts.join(' · ');
    }
    case 'note':
      return `Note · ${state.noteTags.find((t) => t.id === intent.tagId)?.name ?? 'Pinboard'}`;
    case 'vocab':
      return `Vocab card · ${intent.word}`;
    case 'slide':
      return `Slide · ${intent.label} · ${intent.minutes} min later`;
    case 'unknown':
      return `Not sure: ${intent.reason}`;
  }
}
