# CLAUDE.md — Lanternfall

Horror bullet heaven (survivors-like) for desktop and mobile browsers.
**Read `GAME_DESIGN.md` first.** It is the design source of truth. When a
decision changes, update the doc in the same commit.

## Commands (run from `lanternfall/`)
| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (use `--host` to test on a phone over LAN) |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run check` | `tsc --noEmit` + ESLint + Prettier check |
| `npm test` | Vitest unit tests (sim rules, RNG, determinism) |
| `npm run sim` | Headless balance sim, quick mode (50 seeds × bot × character) |
| `npm run sim -- --full` | Full sim (200 seeds); required at M5, M8 and M10 |
| `npm run sim -- --char akari --bot skilled --seeds 20` | Targeted runs while tuning |
| `npm run sim -- --label M2 --compare M1` | Also assert every shared run is bit-identical to an earlier report |
| `npm run shot -- <url> <outDir>` | Playwright screenshots (portrait, landscape, desktop); fails on console errors. Serve first with `npm run build && npx vite preview --port 4173` |

## Architecture rules (do not break these)
1. **`src/sim/` is pure and deterministic.** No DOM, `window`, `document`,
   `performance`, `Date.now`, or `Math.random`. Use the seeded RNG from
   `src/sim/rng.ts` and the fixed 60 Hz step. It must import and run under Node.
2. **One-way flow.** The sim emits events, and `render/`, `audio/` and `ui/`
   consume them. Presentation code never mutates sim state. Only the UI's
   upgrade choice and the `Intent` go back in, through the sim's public API.
3. **Humans and bots are the same to the sim.** Both produce an `Intent`.
   Never add a code path that only bots or only humans take inside `src/sim/`.
4. **Content is data.** Weapons, passives, evolutions, characters, enemies,
   the timeline, SFX and music patterns live in `src/data/` as typed objects.
   Balance changes should normally touch only `src/data/`.
5. **Hot paths don't allocate.** Use pools, a spatial hash and plain number
   fields (no `Vec2` objects created per frame in sim loops).
6. **Rendering never changes outcomes.** The determinism hash for a seed and
   intent log must be identical with and without rendering.

## Art & audio rules
- **Original art only.** Draw sprites in code (vector paths cached to
  offscreen canvases) or hand-author SVG in this repo. Never download, trace
  or imitate existing game, anime or artist assets. Fonts must be OFL and
  bundled with their licence.
- **Palette tokens only** (`src/render/palette.ts`): `ink`, `ink-2`, `ash`,
  `bone`, `gold`. **Gold is reserved** for the player's light, XP embers,
  evolutions, Frenzy and focused UI. Enemies are never gold. Show player
  damage with inversion, not red.
- Every flashing effect must respect the *Reduce flashing* setting (≤ 3 Hz,
  no full-screen inversion). Shake must respect the shake slider.
- All audio is synthesized with WebAudio; there are no sample files. Start the
  AudioContext on the first user gesture.

## Mobile
- Floating joystick in the lower 60% of the screen. Keep tap targets ≥ 48 px
  (upgrade cards ≥ 64 px). Respect `env(safe-area-inset-*)`.
- The camera shows a fixed world area, and spawn distance is based on
  `max(viewW, viewH)` so aspect ratio never changes difficulty.
- Before finishing a milestone that touches input or UI, check a 390×844
  portrait viewport and an 844×390 landscape viewport with Playwright
  (Chromium is preinstalled; do not run `playwright install`).

## Balance simulation
- Lives in `tools/sim/`. Bots: `naive`, `average`, `skilled` (see
  GAME_DESIGN §10; M0 has only a `stub` bot). It runs with worker_threads
  (loaded through `worker-boot.mjs`, which registers tsx) and writes
  `sim-reports/<label>.json` and `sim-reports/<label>.md`. Commit both: the
  JSON holds the per-run hashes that `--compare` checks against.
- Built-in checks: no crashes or non-finite state, determinism (a sample of
  seeds re-run on another thread), speed ≥ 30× real time, and `--compare`
  when given. The exit code is non-zero if any check fails.
- **Target bands** (no meta, per character, survival to 10:00): naive < 5%,
  average 10–25%, skilled 50–70%; skilled + max meta 80–90%.
  These bands are enforced **from M5 onward**. Before M5 the sim checks only
  invariants and reports trends.
- Tune `src/data/` to hit the bands. **Never tune the bots to hit the bands**;
  bot changes need their own commit with a reason.
- A run where bands fail is still committed, but the milestone is not done
  until they pass or the user accepts the deviation.

## Milestone workflow
Work through the milestones in GAME_DESIGN §14, in order. For each one:
1. Implement the deliverables. Small WIP commits are fine.
2. `npm run check && npm test`, and fix everything.
3. `npm run sim`, or `npm run sim -- --full` where §14 says so. Save the report
   as `sim-reports/M<n>.md`.
4. Update `GAME_DESIGN.md` if any design decision changed, plus the
   milestone table status below.
5. Commit with `M<n>: <name>` and a summary of the sim results in the body,
   then push to the working branch.
6. Report to the user: what shipped, sim bands (pass or fail) and open issues.

### Milestone status
| M | Name | Status |
|---|---|---|
| M0 | Scaffold | ✅ done (`sim-reports/M0.md`) |
| M1 | Core loop | not started |
| M2 | Look & feel | not started |
| M3 | Arsenal I | not started |
| M4 | Arsenal II | not started |
| M5 | Night & roster | not started |
| M6 | Power-ups | not started |
| M7 | Audio | not started |
| M8 | Meta & secrets | not started |
| M9 | UI & mobile polish | not started |
| M10 | Balance & release | not started |

## Conventions
- TypeScript strict mode, ES modules, no default exports. File names are
  `kebab-case.ts`, types `PascalCase`, data IDs `snake_case` strings.
- The repo root holds an unrelated HTML/CSS exercise. Keep all game files
  inside `lanternfall/`.
- Stopping a background server: `pkill -f`/`pgrep -f` match your own shell's
  command line too. Use a bracketed pattern, e.g. `pgrep -f "[v]ite.js preview" | xargs -r kill`.
- Save data goes through `src/meta/save.ts`, which is versioned and
  migrations-only. Never read `localStorage` elsewhere.
