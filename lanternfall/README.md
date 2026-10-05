# Lanternfall

A horror bullet heaven for desktop and mobile browsers. You carry a lantern
through one night of yokai until dawn. It is drawn in a modern-anime ×
ukiyo-e style, and every sprite, illustration and sound is generated in code.

- **Play:** the GitHub Pages build at `/lanternfall/` (see CI & deploy in `CLAUDE.md`), or run it locally:
  ```sh
  npm ci
  npm run dev          # http://localhost:5173 (add --host to test on a phone)
  ```
- **Controls:**
  - **Keyboard:** WASD or arrow keys to move; Shift or Space to dash (Hotaru only).
  - **Touch:** a floating joystick in the lower screen, plus an on-screen dash button for Hotaru.
  - **Level-up cards:** keys 1–3 pick a card; R, X and B reroll, skip and banish (once bought at the Shrine).
- **Design:** `GAME_DESIGN.md`. **Working rules and commands:** `CLAUDE.md`. **Playtest guide:** `PLAYTEST.md`.
- **Balance:**
  - `npm run sim` plays thousands of seeded runs headlessly with naive, average and skilled bots.
  - Reports live in `sim-reports/`; each milestone's is `M<n>.md`.

Art and audio are original and procedural. The display face is Shippori
Mincho (SIL OFL 1.1); its licence is in `public/licenses/`.
