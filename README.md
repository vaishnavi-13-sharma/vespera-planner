# Vespera — a storybook planner

This repository is the public source for Vespera. The live, cloud-synced version is privately hosted for my own use and for friends. Anyone can run the full app locally in offline mode with `npm install && npm run dev`: no API keys and no database setup, and your board is saved in your browser.

## What it is

Vespera is a weekly planner with the look of an old storybook: warm colors, wax seals and candles. You plan your day on a timeline, check off tasks on a Quest Board, and keep notes and flashcards on a Pinboard.

## Features

- **Daily Timeline:** a rolling week of time blocks that can repeat daily, on weekdays, weekly or monthly. A "now" line shows where you are, and if you're running late, Vespera offers to move the rest of the day later (never past midnight).
- **Quest Board:** tasks in categories you can rename, recolor and reorder, with optional due dates and drag and drop. Checking a task off stamps it with your wax seal and fills today's progress bar.
- **History:** every task you've finished, grouped by day, with older months summarized.
- **Gentle Start:** when you're stuck, it picks one small step and starts a short timer.
- **Pinboard:** notes with tags, plus vocab flashcards and a "Daily 5" spaced-repetition review.
- **Quick Scribe (⌘K / Ctrl K):** type a line like `Thu 3-5pm study` or `quest: email tutor tomorrow` and it becomes a time block, task or note. It works offline with no AI; adding your own AI key is optional. *Plan my day* fits open tasks into free time.
- **Focus Timer:** a full-screen timer with Pomodoro options and optional rain or fire sounds.
- **Weekly candles:** one candle per day, lit by any small win, and a short recap each Monday.
- **Settings:** four color themes (including a light one), your own wax seal, pin styles, a small desk decoration and a sky that follows the time of day.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173, offline mode, saved in your browser
```

Other commands:

```bash
npm test             # unit and component tests
npm run test:e2e     # headless browser tests at phone, tablet and desktop sizes
npm run build        # type check and production build
```

## Self-host with sync (optional)

1. Create a Supabase project.
2. Run the SQL files in [`supabase/migrations/`](supabase/migrations) in order, in the project's SQL Editor.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (for local work, in `.env.local`).
4. Build with `npm run build` and serve the `dist` folder from any static host. Add your site's address to the project's allowed redirect URLs so sign-in can return to it.

With these settings, sign-in is required and boards sync between devices. A production build without them shows a "sign-in isn't set up" page instead of opening.

## Security

A red-team / blue-team review and its fixes are recorded in [`docs/SECURITY_QA_HITLIST.md`](docs/SECURITY_QA_HITLIST.md).

## License

[MIT](LICENSE) © 2026 Vaishnavi Sharma
