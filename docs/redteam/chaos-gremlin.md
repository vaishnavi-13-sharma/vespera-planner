# Chaos Gremlin: findings (state, time and UI)

Wave 1 of the Red Team / Blue Team pass (`docs/superpowers/plans/2026-11-12-redblue.md`).
Every finding has a repro in `src/redteam/chaos/` that asserts the **correct** behaviour and fails on today's `main`.
Run them with `npm run test:redteam`. Shared test helpers live in `src/redteam/chaos/harness.tsx`.

**Counts:** Critical 0 · High 4 · Medium 5 · Low 1 (10 findings, 30 failing assertions).

---

## High

### CG-01 · High · An unreadable save is silently replaced, then overwritten for good
- **Where:** `src/context/storage.ts:55` (`loadState`, plus `validate` at `:27`) and the save effect in `src/context/VesperaContext.tsx:161`
- **Repro:** `src/redteam/chaos/cg-01-corrupt-save-overwritten.test.tsx`
- **Impact:** If `vespera_state_v2` is truncated (crash mid-write, full disk) or has a single malformed item (one note with a numeric id), the whole board is rejected. The app loads the starter board, or the owner's **days-old v1 copy**, says nothing, and the next save writes over the only copy of the real board.
- **Suggested fix:** Before falling back, copy the unreadable raw text to a backup key (e.g. `vespera_state_v2_unreadable_<ts>`) and set a notice. Ideally, drop or repair the bad items one by one instead of rejecting the whole board.
- **Owner:** Fixer 2 (State & Input)

### CG-02 · High · Two open tabs silently erase each other's edits
- **Where:** `src/context/VesperaContext.tsx:161` (saves the whole state; there is no `storage` event listener)
- **Repro:** `src/redteam/chaos/cg-02-two-tabs-clobber.test.tsx`
- **Impact:** With the installed PWA and a browser tab open (or two tabs), each tab keeps its own in-memory board and writes all of it on every change. A quest added in tab B disappears the moment tab A checks anything off, and tab A never shows B's changes.
- **Suggested fix:** Listen for `storage` events on the active key and adopt the newer board (`replaceState` after `parseState` + `rollover`), or merge. Keep the per-account key in mind (`storageKey`).
- **Owner:** Fixer 2 (State & Input). Note for Fixer 1: sync's `lastLocalEdit` / echo logic should treat a cross-tab adopt as remote, not local.

### CG-03 · High · Undoing a capture "slide" erases every later edit to that repeating block
- **Where:** `src/context/reducer.ts:455` (`revertCapture` restores `slide.series[].exceptions`, a snapshot of the whole series' exceptions)
- **Repro:** `src/redteam/chaos/cg-03-undo-slide-wipes-edits.test.ts`
- **Impact:** "slide evening 30m" → skip tomorrow's walk, or edit another date → tap Undo on the still-visible toast. The skip and the edit vanish, because Undo puts back the *entire* pre-capture exception map for that series. The same happens if a cloud sync replaced the board before Undo: the synced exceptions are overwritten.
- **Suggested fix:** Record only the slid date's previous `overrides` (start/end) per series, and on undo restore just that date's times, leaving other dates and other fields alone.
- **Owner:** Fixer 2 (State & Input)

### CG-04 · High · Odd settings or activity from an old save, backup or sync crash the app on the first tap
- **Where:** `src/context/storage.ts:27` (`validate` checks only ids and Sanctuary settings; `settings`, `activity` and `focusSession` pass through unchecked)
- **Repro:** `src/redteam/chaos/cg-04-old-save-settings.test.ts`
- **Impact:** A board with `unstickActions: null` loads, then **Break the Spell throws** inside the reducer. `activity: null` throws on the first quest check-off. There is no error boundary, so either one blanks the whole app, and the bad board is already persisted, so it comes back after a reload. `dayStart ≥ dayEnd` makes Plan my day empty and the sky always night. `volume: "loud"`, `focusMinutes: "abc"` (gives `endsAt: NaN`) and a partial `focusSession` (a chamber with a NaN timer) all load as-is.
- **Suggested fix:** Add a `sanitizeSettings` next to `sanitizeSanctuary`: check types and ranges for every field, fall back to the defaults, and require `dayEnd > dayStart`. Coerce `activity` to an object, and drop a `focusSession` that is missing numeric fields.
- **Owner:** Fixer 2 (State & Input). Likely overlaps Vault Breaker's `parseState` depth findings: same function, so dedupe.

## Medium

### CG-05 · Medium · Quick capture turns impossible dates into other days
- **Where:** `src/context/capture.ts:117` (`dated` uses `new Date(year, month, day)`, which rolls over)
- **Repro:** `src/redteam/chaos/cg-05-impossible-dates.test.ts`
- **Impact:** "quest: pay rent Feb 30" is due **Mar 2**, "Apr 31 3-4pm dentist" lands on **May 1**, "13/5" becomes January, and "Feb 29" (from Nov 2026) becomes **Mar 1 2027** instead of the next real leap day, 2028-02-29. All of it happens silently.
- **Suggested fix:** After building the date, check that its month and day match the input. If not, return `unknown` with "That date doesn't exist", like impossible times already do. For Feb 29, roll forward to the next year that has one.
- **Owner:** Fixer 2 (State & Input)

### CG-06 · Medium · Push 30m, the running-late slide and capture "slide" push blocks past midnight
- **Where:** `src/context/recurrence.ts:102` (`rippleTimes`), used by `pushOccurrence` (`src/context/reducer.ts:183`), `LateRibbon` and `parseSlide` (`src/context/capture.ts:185`)
- **Repro:** `src/redteam/chaos/cg-06-push-past-midnight.test.ts`
- **Impact:** At 10 pm, "slide 4h", or Push 30m on a 22:30 block, stores `end` values like 1455 or 1650. The card then reads "12:15 AM" on the *same* day, timelines and Plan my day get minutes beyond the day, and a new block typed the same way is refused ("Blocks can't run past midnight"). The rules disagree.
- **Suggested fix:** In `rippleTimes`, refuse (return `{}`) or clamp when any moved block would end after 1440. Have `parseSlide` refuse with the same message, and disable Push 30m when it can't fit.
- **Owner:** Fixer 3 (Timekeeper). Note for Fixer 2: the `parseSlide` message lives in `capture.ts`.

### CG-07 · Medium · A focus session left burning credits all its minutes to the day the app is reopened
- **Where:** `src/context/reducer.ts:339` (`finishFocus` logs to `action.today`)
- **Repro:** `src/redteam/chaos/cg-07-focus-credited-to-today.test.ts`
- **Impact:** Start a 2-hour candle Monday night and close the laptop. When you open Vespera on Thursday, the chamber finishes and logs 120 focus minutes to **Thursday**, lighting Thursday's candle and skewing the weekly recap. Monday stays dark.
- **Suggested fix:** Credit the minutes to the local date of `startedAt` (or split them across days when a session crosses midnight), not to `today`.
- **Owner:** Fixer 2 (State & Input). Note for Fixer 3: the chamber's toast copy (`FocusChamber.tsx:67`) could say when the candle burned.

### CG-08 · Medium · ⌘K during a focus session opens Quick capture *under* the Focus Chamber
- **Where:** `src/components/capture/CaptureLauncher.tsx:12` (the global ⌘K handler ignores the chamber); the chamber is `z-[55]`, the Sheet `z-40`
- **Repro:** `src/redteam/chaos/cg-08-cmdk-behind-focus-chamber.test.tsx`
- **Impact:** Pressing ⌘K/Ctrl+K in the Focus Chamber moves keyboard focus into an invisible textarea behind it. Typing and Enter then save hidden captures, and the chamber's pause and end buttons lose focus.
- **Suggested fix:** Ignore ⌘K while `state.focusSession` is set (or while any modal that isn't a Sheet is open), or raise the capture sheet above the chamber. The test accepts "ignored".
- **Owner:** Fixer 2 (State & Input, `capture/**`). Note for Fixer 3 if the chamber should register in `overlayStack`.

### CG-09 · Medium · Sheets are `aria-modal` but don't trap Tab
- **Where:** `src/components/ui/Sheet.tsx:25` (focuses the panel and handles Escape, but has no Tab wrap)
- **Repro:** `src/redteam/chaos/cg-09-sheet-focus-trap.test.tsx`
- **Impact:** Keyboard-only users tab out of the block editor, Vanity drawer or Quick capture into controls hidden behind the backdrop, and can activate them without seeing them. The Focus Chamber already traps Tab, so this is inconsistent.
- **Suggested fix:** Reuse the chamber's Tab and Shift+Tab wrap in `Sheet` (first and last focusable inside the panel).
- **Owner:** Fixer 4 (Layout & Mobile)

## Low

### CG-10 · Low · Long runs of spaces make the capture parser quadratic, freezing typing
- **Where:** `src/context/capture.ts:151` (range regex `\s*(am|pm)?\s*`) and `:134` (`every` regex `\s*(?:,|and|&)?\s*`). `CaptureSheet` re-parses on every keystroke (`useMemo` on `text`).
- **Repro:** `src/redteam/chaos/cg-10-capture-whitespace-freeze.test.ts`
- **Impact:** A 40k-character pasted line ("1" or "every mon" followed by spaces) takes about 1–2 s to parse, and that cost repeats on each keystroke while it sits in the box. It is self-inflicted only, but it can lock up a phone.
- **Suggested fix:** Collapse whitespace runs (`text.replace(/\s+/g, ' ')`) before parsing, and/or cap a line's length (e.g. 500 characters) with an "unknown: that line is too long" result.
- **Owner:** Fixer 2 (State & Input)

---

## Probed and holding (no finding)
- **DST and time zones:** `addDays`, `daysBetween`, `weekdayOf`, `rollingWeek` and a fortnightly weekly series were checked for 800 days in America/Santiago (midnight DST), New York, London, Lord Howe (30-min DST) and Beirut. All held.
- **App open across midnight:** the minute clock plus the rollover effect move finished quests at midnight, and the Timeline follows "today" forward (`TimelinePanel.tsx:28`).
- **Vocab steps out of range:** `nextReview` clamps high and negative steps. Daily 5 handles 0 cards ("All caught up") and large decks.
- **Paste storm:** 500 ordinary capture lines parse in about 2 ms.
- **`__proto__:` / `constructor:` prefixes:** the prefix regex needs a leading letter and tag lookup is by `find`, so there's no prototype access.
- **Monthly repeats on the 29th–31st** skip short months, which is documented behaviour (`types.ts:37`).
