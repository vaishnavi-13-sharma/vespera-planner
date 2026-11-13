# Security and QA hit list (Red Team / Blue Team, 2026-11-12)

This combines the Wave 1 findings of **Vault Breaker** (`docs/redteam/vault-breaker.md`, security and privacy) and **Chaos Gremlin** (`docs/redteam/chaos-gremlin.md`, state, time and UI). The full write-ups (where, impact, suggested fix) live in those two files. This page is the to-do list, the final owners, and the status.

**Totals:** 21 findings, 0 Critical, 5 High (after merging VB-01 with CG-04), 8 Medium, 8 Low.

**Checked and sound:**
- RLS on `user_states`: select, insert, update and delete are scoped to `auth.uid()`, with `WITH CHECK` and no anon policy.
- `updated_at` is set by the server, and the 2 MB size check holds.
- No XSS sinks.
- No prototype pollution path.
- Oracle reply checking.
- The bridge's origin and host guard.
- Nothing personal in `dist/`, and no source maps.
- PKCE OAuth.
- Daylight-saving changes, midnight rollover, vocab steps and paste storms.

## Owners for Wave 2

These replace the table in the Red/Blue plan. Fixer 3 picked up the parser and Oracle files to balance the load.

| Fixer | Owns |
|---|---|
| **1: Auth, Sync & Edges** | `src/sync/**`, `supabase/**`, `src/components/account/**`, `src/ai/**`, `vite/**`, `public/**`, `src/components/oracle-settings/**` |
| **2: State & Input** | `src/context/**` except `dates.ts`, `recurrence.ts`, `rollover.ts`, `capture.ts`, `oracle.ts`; plus `src/lib/**` |
| **3: Time & Capture** | `src/context/dates.ts`, `recurrence.ts`, `rollover.ts`, `capture.ts`, `oracle.ts`; `src/components/timeline/**`, `TimelinePanel.tsx`, `focus/**`, `capture/**`, `oracle/**` |
| **4: Layout & Mobile** | every other `src/components/**` file and folder (including `ui/**` and `ErrorBoundary.tsx`), plus `src/index.css` |

**Moving the repro tests:** each fixer moves *their* repro files out of `src/redteam/**` into a test file next to the code they fix, inside their own paths. Deleting their own repro files from `src/redteam/**` is allowed.

**Shared files** stay with the coordinator: `App.tsx`, `main.tsx`, `index.html`, configs, `package*.json`, `CLAUDE.md`, `docs/**` (except your ✅ in this file), `src/test/**`. Ask via `orca orchestration ask`.

## The list

| ✅ | Id | Sev | Finding | Owner |
|---|---|---|---|---|
| ✅ | **VB-01 + CG-04** | High | A hostile or odd board (backup, cloud row, old save) crashes the app on every reload and every device. `validate` must check deeply and repair or drop bad items. | **2** (+4 builds the recovery screen in `ErrorBoundary.tsx`, already mounted in `App.tsx`) |
| ✅ | **CG-01** | High | An unreadable save is silently replaced, then overwritten for good. Keep the bad copy and never overwrite it blindly. | **2** |
| ✅ | **CG-02** | High | Two open tabs erase each other's edits. Add a `storage` listener and adopt newer state. | **2** (Fixer 1: sync treats a cross-tab adopt as remote) |
| ✅ | **CG-03** | High | Undoing a capture slide wipes later edits to that repeating block. Restore only the moved times. | **2** |
| ✅ | **VB-02** | High | Sign-out leaves the account's board and conflict backups on the device. Clear them on sign-out (warn first if unsynced), and keep backups per user. | **1** |
| ✅ | **VB-03** | Medium | The paid Anthropic key outlives sign-out. | **1** |
| ✅ | **VB-04** | Medium | A board the server refuses shows "Offline" forever. Show a real error, and check the size before pushing. | **1** |
| ✅ | **VB-05** | Medium | No `public/_headers`: no CSP, framing allowed. Fonts are now self-hosted, so `font-src 'self'` works. | **1** |
| ✅ | **CG-05** | Medium | Capture turns impossible dates (Feb 30) into other days. | **3** |
| ✅ | **CG-06** | Medium | Push 30m, the running-late slide and capture slide push blocks past midnight. | **3** |
| ✅ | **CG-07** | Medium | A forgotten focus session credits its minutes to the day you reopen the app. | **2** (reducer `finishFocus`; Fixer 3 may adjust the chamber's toast) |
| ✅ | **CG-08** | Medium | ⌘K during a focus session opens Quick capture *under* the Focus Chamber. | **3** |
| ✅ | **CG-09** | Medium | Sheets are `aria-modal` but don't trap Tab. | **4** |
| ✅ | **VB-06** | Low | Dev bridge: the line cap can be bypassed, and the system prompt comes from the client. The bridge should build the prompt itself. | **1** (if `buildOraclePrompt` must change shape, ask Fixer 3) |
| ✅ | **VB-07** | Low | Dev bridge reads the body before the guard and has no deadline. | **1** |
| ✅ | **VB-08** | Low | Raw auth errors reveal whether an email has an account. | **1** |
| ✅ | **VB-09** | Low | `.gitignore` didn't ignore `.env`. Fixed by the coordinator; the test now lives in `src/test/`. | coordinator |
| ✅ | **VB-10** | Low | Google Fonts leaked visitors' IPs. Fonts are now self-hosted via `@fontsource` (Latin only); the test now lives in `src/test/`. | coordinator |
| ✅ | **VB-11** | Low | Category and tag names are pasted raw into the Oracle system prompt. | **3** |
| ✅ | **CG-10** | Low | Long runs of spaces make the capture parser quadratic. | **3** |
| ✅ | *optional* | Low | Add `set search_path = ''` to the trigger function, in a new `0002` migration (Supabase linter). | **1** |

## Live checks (2026-11-12, two throwaway accounts, owner-approved)

25 of 25 passed:
- **Isolation:** row-level security keeps every board private. Another account can't read, write, delete or take over a board (`42501`), and a signed-out visitor sees nothing.
- **Ownership:** a board can't be moved to another account.
- **Version guard (0003):** schema downgrades are refused with `VSP01`, including for a non-number version, and a client can't fake `schema_version`.
- **Size:** the 2 MB check holds (`23514`).
- **Live updates:** inserts and updates never reach another account's Realtime channel.

**Confirmed and fixed:** the Realtime DELETE leak. A deleted row's `user_id` reached other listeners. Migration `0004` stops the publication from sending deletes; run it in the dashboard.

## Originally unproven (now resolved or dashboard settings)

- Realtime DELETE events aren't RLS-filtered. That would only leak user UUIDs, and the app never deletes rows.
- Set the server password minimum to 8 or more and turn on leaked-password protection (Auth → Providers → Email).
- Open sign-up against the 500 MB quota: keep email rate limits; add CAPTCHA only if it's ever abused.
