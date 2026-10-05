# Lanternfall: human playtest guide (M10)

The balance simulation measures bots. This playtest checks what bots can't:
whether the night *feels* fair and hard on a first try, and how it runs on a
real phone. One or two players, 30–60 minutes each, is enough.

## Before you start
- Use the deployed build (GitHub Pages, `/lanternfall/`) or `npm run build && npx vite preview --host`, opened on a phone on the same network.
- First launch shows a photosensitivity notice. Answer it honestly; the playtest covers both settings.
- To start from a clean profile, open the browser console and run `localStorage.removeItem('lanternfall.save')`.

## What to do
1. **Blind first run.** Play with Akari without reading anything else. Note when you died and what killed you (the results screen and banners say).
2. **Three more runs.** Try Ren, then whoever you have unlocked. Visit the Shrine between runs.
3. **One phone run in each orientation** (portrait, then landscape).

## What to note (rough is fine)
| Question | Target |
|---|---|
| Time of death on your first run | Hard on a first try: most players die between 4:00 and 8:00 |
| Did any death feel unfair or invisible? (a hit you couldn't see coming) | No |
| Could you read every telegraph: lunges, slams, shots? | Yes, at a glance |
| Level-up cards: understood what each did? | Yes |
| Power-ups: noticed stone lanterns and wanted to break them? | Yes |
| Phone: did the joystick feel right? Did your thumb cover anything important? | Feels right; nothing covered |
| Phone: any stutter? Note what was on screen | Smooth (the game lowers resolution itself if needed) |
| Audio: was any sound grating or too loud? | No |
| Art: does it read as anime × ukiyo-e? Which pieces look off? | Yes |

## How the results feed back
- **Deaths:** human death times calibrate the bot bands. If humans die much earlier or later than the average bot (10–25% survival), the balance data gets tuned (`src/data/`), never the bots.
- **Unfair hits:** each one becomes a telegraph or readability fix.
- **Phone frame times:** set the performance budget (GAME_DESIGN §12.3).
