# Vault Breaker: security and privacy findings (Wave 1)

Attacker: Vault Breaker. Date: 2026-11-12. Base: `main` at `b6fb5c7`.
Repros: `src/redteam/vault/` (run with `npm run test:redteam`). Every test asserts the *correct* behaviour and fails today because of the bug.
Shared helper: `src/redteam/vault/bridgeHarness.ts` drives the dev bridge in-process. The tests mock `node:child_process`, so no real `claude` ever runs.

| Severity | Count | Ids |
|---|---|---|
| Critical | 0 | none |
| High | 2 | VB-01, VB-02 |
| Medium | 3 | VB-03, VB-04, VB-05 |
| Low | 6 | VB-06 to VB-11 |

No Critical: RLS holds, no script runs from data, no secret is shipped, and the owner's week is not in `dist/`. (See "Checked and sound" below.)

---

## High

### VB-01 · High · A hostile board (backup file or cloud row) crashes the whole app, and keeps crashing
- **Where:** `src/context/storage.ts:27` (`validate`, behind `parseState` :47 and `parseImport` :111). Crash sites include `src/components/quest/TaskCategorySection.tsx:46` (`ACCENT_STYLES[category.accent]`) and `src/context/recurrence.ts:29` (`rule.weekdays.includes`). There is no error boundary in `src/App.tsx`.
- **Repro:** `src/redteam/vault/vb-01-hostile-board-crash.test.tsx` (6 tests: 3 vectors × {app opens, validator rejects or repairs})
- **Impact:** The validator only checks that each list holds objects with a string `id`. Three examples get through: a category `accent: "purple"`, a quest `title` that is an object, and a weekly series without `weekdays`. Any one of them throws during render and blanks every panel. The bad board is already saved to localStorage, so every reload crashes again. Signed in, it also syncs, so every device crashes as well. Example: a friend shares a "planner template" backup, you import it, and the app is bricked everywhere until someone clears storage by hand.
- **Suggested fix:** Validate deeply in `validate`: field types, enums (`accent`, `kind`, `repeat.freq`), weekday arrays, and string caps. Drop or repair bad items instead of trusting the spread `...s`. Also add a top-level error boundary with a "restore from backup / start fresh" escape.
- **Owner:** Fixer 2 (State & Input). The error boundary touches `src/App.tsx` (shared), which needs the coordinator.

### VB-02 · High · Signing out leaves the account's whole board, and its conflict backups, on the device
- **Where:** `src/sync/SyncProvider.tsx:145-150` (sign-out only switches `storageKey`). The cache is written at :67-73 under `vespera_state_v2:<userId>`. Conflict copies are written at :321 under the *un-namespaced* `vespera_state_v2_conflict_<ms>`.
- **Repro:** `src/redteam/vault/vb-02-signout-leaves-board.test.tsx`
- **Impact:** After "Sign out" on a shared or borrowed laptop, the next person can read every quest, note, block and vocab card in plaintext from localStorage (DevTools → Application). Conflict backups are not tied to any account, so they pile up and survive every sign-out. By the severity table this is close to Critical (another person's data exposed). I rated it High because it needs physical access to the device.
- **Suggested fix:** On sign-out, remove `userStorageKey(userId)` and that user's conflict backups once everything is pushed. If unsynced edits exist, warn first ("Sign out and forget this device?"). Namespace conflict backups per user (`…_conflict_<userId>_<ms>`).
- **Owner:** Fixer 1 (Auth, Sync & Edges)

## Medium

### VB-03 · Medium · The person's paid Anthropic key outlives sign-out, so the next user spends it
- **Where:** `src/ai/oracleKey.ts:2` (`vespera_oracle_key`, device-wide). `src/sync/SyncProvider.tsx:225` (`signOut`) never touches it.
- **Repro:** `src/redteam/vault/vb-03-oracle-key-outlives-signout.test.tsx`
- **Impact:** After sign-out, the Oracle still says "Using your key", and anyone using the device runs requests billed to the key's owner. The key also sits in plaintext localStorage, readable by anyone on the device and by any injected script (see VB-05).
- **Suggested fix:** Remove the key on sign-out, or scope it to the account (`vespera_oracle_key:<userId>`) and ignore it while signed out. Say so in the Oracle settings copy.
- **Owner:** Fixer 1 (Auth, Sync & Edges)

### VB-04 · Medium · A board the server refuses shows "Offline" forever and never syncs again
- **Where:** `src/sync/SyncProvider.tsx:306-307` (every push error becomes `offline`; `'error'` is declared at :18 but never set). There is no client-side cap matching the 2 MB check in `supabase/migrations/0001_user_states.sql:9`.
- **Repro:** `src/redteam/vault/vb-04-rejected-push-says-offline.test.tsx`
- **Impact:** Once a board passes 2 MB (years of activity and Chronicle, or a big imported backup), every push is rejected with a check violation. The badge keeps promising "Changes are saved on this device and will sync when you're back", but they never sync. Other devices drift, and a later conflict can throw the newer work into a backup.
- **Suggested fix:** Treat PostgREST/Postgres errors (with a `code`, e.g. `23514`) as `error`, with a clear message. Reserve `offline` for network failures. Check the size before pushing.
- **Owner:** Fixer 1 (Auth, Sync & Edges)

### VB-05 · Medium · No security headers on Cloudflare Pages (no CSP, framing allowed)
- **Where:** `public/_headers` is missing.
- **Repro:** `src/redteam/vault/vb-05-security-headers.test.ts` (static)
- **Impact:** Any site can frame Vespera and clickjack "Reset everything", "Sign out" or "Remove key". With no CSP, any script that gets in (for example a compromised dependency) can read the plaintext Anthropic key (VB-03) and every cached board (VB-02), then send them anywhere. There is no Referrer-Policy and no `nosniff`.
- **Suggested fix:** Add `public/_headers` for `/*` with these headers:
  - CSP: `default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com; img-src 'self' data: https://*.googleusercontent.com; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`. Adjust it for VB-10.
  - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - `realm-boot.js` is already external, so `script-src 'self'` works.
- **Owner:** Fixer 1 (Auth, Sync & Edges)

## Low

### VB-06 · Low · Dev bridge: the line cap is bypassable and the system prompt is client-controlled
- **Where:** `vite/claude-bridge.ts:157-163`. The guard checks `payload.text`, but `runClaude` receives `payload.system` + `payload.user`, which are never compared with it.
- **Repro:** `src/redteam/vault/vb-06-bridge-prompt-cap.test.ts`
- **Impact:** Anything able to POST same-origin to the dev server (a malicious npm dependency, or an injected script in the dev tab) can send about 4 KB of arbitrary prompt, plus its own system prompt, to the owner's `claude` CLI. That spends the owner's subscription and ignores the "one line of up to 500 characters" promise. Tools stay off, which limits the damage. This is dev-only.
- **Suggested fix:** Build the prompt on the bridge from the checked `text` and small structured fields (today, category/tag names) instead of accepting `system`/`user` strings. Or at least require `user === 'Planner line: ' + JSON.stringify(text)` and a fixed system template.
- **Owner:** Fixer 1 (Auth, Sync & Edges). The client shape lives in `src/ai/askOracle.ts` (Fixer 1) and `src/context/oracle.ts` (Fixer 2).

### VB-07 · Low · Dev bridge: the body is read before the guard, with no deadline
- **Where:** `vite/claude-bridge.ts:150-157` (`readBody` at :105 runs before `checkBridgeRequest`).
- **Repro:** `src/redteam/vault/vb-07-bridge-body-before-guard.test.ts` (another machine, rebinding Host, foreign Origin, `Origin: null`)
- **Impact:** A request that should be rejected at once is never answered if its body never ends. The socket hangs until Node's request timeout (minutes), and the server JSON-parses untrusted bodies before deciding who is asking. Many such requests pin the dev server.
- **Suggested fix:** Run `checkBridgeRequest` on method, address, Host, Origin and content-type (plus `content-length`) *before* reading the body. Then read with a short deadline (e.g. 2 s → 408) and destroy the socket on overflow.
- **Owner:** Fixer 1 (Auth, Sync & Edges)

### VB-08 · Low · Raw Supabase auth errors reveal whether an email has an account
- **Where:** `src/sync/supabaseBackend.ts:42` (`error?.message`) → `src/components/account/SignInSheet.tsx:48`
- **Repro:** `src/redteam/vault/vb-08-auth-error-enumeration.test.tsx`
- **Impact:** With email confirmation off, "Create account" for a taken address shows "User already registered". Anyone can check whether a specific friend or family member uses Vespera. With confirmation on, Supabase hides this, but the app shouldn't depend on a dashboard setting.
- **Suggested fix:** Map auth errors to a few friendly, non-revealing messages. For sign-up, always show the "Almost there… check your email" notice.
- **Owner:** Fixer 1 (Auth, Sync & Edges)

### VB-09 · Low · `.gitignore` does not ignore `.env`
- **Where:** `.gitignore:3` (only `*.local`)
- **Repro:** `src/redteam/vault/vb-09-env-not-ignored.test.ts` (static)
- **Impact:** A plain `.env` or `.env.production` (what most Supabase/Cloudflare guides use) gets committed by `git add .`. If the service_role key ever lands there, it bypasses all RLS. Any `VITE_`-prefixed secret is also inlined into the public bundle.
- **Suggested fix:** Add `.env`, `.env.*` and `!.env.example`.
- **Owner:** Fixer 1 (Auth, Sync & Edges). `.gitignore` is a shared config, so the coordinator must approve.

### VB-10 · Low · Every visit sends friends' IPs to Google (Google Fonts)
- **Where:** `index.html:19-24`
- **Repro:** `src/redteam/vault/vb-10-google-fonts.test.ts` (static)
- **Impact:** A "private" planner tells Google each visitor's IP address, user agent and visit times. It also forces a third-party origin into the CSP (VB-05).
- **Suggested fix:** Self-host the two families as woff2 in `public/fonts/`, declare them with `@font-face`, and drop the Google links and the `google-fonts` runtime cache in `vite.config.ts`. This is free and needs no new dependencies.
- **Owner:** Fixer 1 (`index.html`, `public/**`). `@font-face` goes in `src/index.css` (Fixer 4), and `vite.config.ts` is shared.

### VB-11 · Low · Category and tag names are pasted raw into the Oracle *system* prompt
- **Where:** `src/context/oracle.ts:43-44` (`buildOraclePrompt`)
- **Repro:** `src/redteam/vault/vb-11-oracle-prompt-injection.test.ts`
- **Impact:** A name containing newlines becomes its own line of system instructions, for example from a shared template backup or a synced board. It can steer every Oracle reply into a chosen category or wording. Replies are only previewed until the person presses Enter, so the harm is misleading suggestions, not silent writes.
- **Suggested fix:** JSON-quote each name (or strip control characters and newlines and cap the length), and mark the lists as data like the typed line.
- **Owner:** Fixer 2 (State & Input)

---

## Unproven (needs a live project or a dashboard setting)

- **Realtime DELETE events are not RLS-filtered.** Supabase documents that `postgres_changes` can't apply RLS or filters to DELETE events. The old record (here the primary key `user_id`) of *any* deleted row then goes to every subscriber of `user_states`. The app never deletes rows itself, but an account deletion cascades. That would leak other users' UUIDs only, not boards. Check live with two throwaway accounts (owner's OK needed). If confirmed, the fix is Realtime Broadcast from the database, or never hard-deleting.
- **Password minimum is client-side only.** `SignInSheet` asks for 8+ characters, but the Supabase default minimum is 6, and the API can be called directly. Set the minimum (and leaked-password protection) in the dashboard: Auth → Providers → Email.
- **Trigger function `search_path`.** `touch_user_states_updated_at` has a mutable `search_path`, which the Supabase linter will warn about. It is not `SECURITY DEFINER`, so I found no exploit. Adding `set search_path = ''` is a nice-to-have.
- **Open sign-up vs. quota.** Each account may store up to 2 MB, so roughly 250 scripted sign-ups fill the 500 MB free tier. Supabase's default email rate limits make this slow. Keep confirmation on, or add CAPTCHA if it is ever abused.

## Checked and sound (no finding)

- **RLS (`0001_user_states.sql`):**
  - Select, insert, update and delete are all `to authenticated` and scoped to `auth.uid() = user_id`.
  - Update has both `USING` and `WITH CHECK`, so a row can't be moved to another `user_id`. The FK blocks made-up ids.
  - No `anon` policy exists, so anon gets nothing despite the default grants.
  - `updated_at` is server-stamped by a `BEFORE INSERT OR UPDATE` trigger, so clients can't forge it. The 2 MB check holds on the server.
- **Realtime INSERT/UPDATE:** filtered by `user_id=eq.<uid>` and RLS-checked. The client also only reads `payload.new`.
- **XSS:** No `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `href={userText}` anywhere. Every `style` prop is built from computed numbers or fixed palettes. Accents go through a lookup table: a bad value crashes the app (VB-01) but can't inject. `public/realm-boot.js` applies only regex-checked `#rrggbb` tokens and an `[a-z]{3,12}` realm id.
- **Prototype pollution:** `JSON.parse` plus object spread only creates an own `__proto__` key. Reducer writes use spreads or computed keys on fresh objects, so I found no path to `Object.prototype`.
- **Oracle:**
  - `parseOracleReply` handles oversized, nested, wrong-type, fenced and `kind: 'slide'` replies. Unknown kinds are dropped, text is clipped to 200 characters, actions to 10, dates to ±1 year, and categories and tags are matched against the board.
  - The key never enters `VesperaState`, exports, sync or logs.
  - `askOracle` errors map to fixed messages, so the key can't leak into UI text.
- **Dev bridge guard:**
  - Loopback-only, exact `localhost`/`127.0.0.1` Host (rebinding and `[::1]` Host are rejected), exact Origin (`null` rejected), JSON-only, 4 KB body.
  - The prompt goes on stdin with `shell: false`, with `--tools ''`, `--strict-mcp-config` and `--disable-slash-commands`.
  - The bridge is `apply: 'serve'`, so its code is not in `dist/`.
- **Shipping:** `npm run build` output has none of the owner's real strings (searched for Café, language-app, Tutor, Personal Essay, Exam Module) and no `.map` files. The service worker precaches only the app shell, and Supabase and Anthropic requests are never cached.
- **OAuth:** PKCE flow, `redirectTo: window.location.origin`, `detectSessionInUrl`. I found nothing open-redirectable.
