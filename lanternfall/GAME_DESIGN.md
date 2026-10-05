# Lanternfall — Game Design Document

> Status: **v0.1 design draft** (pre-code). All numbers are *initial tuning values*;
> the source of truth once code exists is `src/data/*.ts`, and this doc is updated
> whenever a milestone changes a design decision.

## 1. Pitch

**Lanternfall** is a horror bullet heaven for desktop and mobile browsers. Each
night the paper lanterns of a drowned shrine town go out one by one, and the
things beneath the water walk up the stone steps. You are the last lantern-bearer.
You hold out for ten minutes until dawn. Your weapons fire on their own, and the
night gets worse every minute.

- **Genre:** auto-shooter / survivors-like ("bullet heaven").
- **Session:** a 10:00 run; dawn at 10:00 is the victory. An optional endless
  "Long Night" mode follows.
- **Platforms:** desktop browsers (keyboard) and mobile browsers (touch,
  portrait or landscape).
- **Pillars:**
  1. **Dread → power.** The early game feels fragile and the late game feels
     like a storm of light you control. The *contrast* between the two is the fantasy.
  2. **Readable in black and white.** Every threat reads as a silhouette. Colour
     is reserved, and gold always means *your light*.
  3. **Hard but fair.** Most first runs fail, and every death feels like your
     own fault: no off-screen hits and no unreadable bullets.
  4. **Secrets reward curiosity.** Hidden characters and undocumented weapon
     unions give the run-after-run loop something to discover.

## 2. Setting & tone — folk / yokai dread

The town of **Minasoko** ("water-bottom") drowned when a dam broke a century
ago. Once a year the reservoir drains for a single night. The townsfolk climb
back out, and so does everything they used to keep away with lantern light.

The tone is quiet, wet and ceremonial. Every enemy is an **original design**
*inspired by* Japanese folklore archetypes (faceless people, lantern spirits,
long-necked women, crows and skeletal giants). They are never copies of any
specific existing game, anime or artist's depictions. Names are our own.

The story is environmental only: there are no cutscenes in v1. The death screen
and the unlock text carry one-line fragments.

## 3. Core loop

```
Move (only input) ─▶ weapons auto-fire ─▶ enemies die ─▶ drop Spirit Embers (XP)
      ▲                                                        │
      │                                                        ▼
  survive the timeline ◀── pick 1 of 3 upgrades ◀── level up
      │
      ├─ elites drop Reliquaries (chests) ─▶ upgrades / EVOLUTIONS
      └─ break stone lanterns ─▶ power-ups, food, coins
Run ends: death (meta currency kept) or Dawn at 10:00 (victory + bonus).
```

### 3.1 Run rules
| Rule | Value |
|---|---|
| Weapon slots | 6 |
| Passive slots | 6 |
| Weapon max level | 8 |
| Passive max level | 5 (Paper Doll: 2) |
| Choices per level-up | 3 (4 with Luck ≥ 30% roll) |
| XP to next level | `5 + 10·(L−1)` up to L20, then +13 per level, and every requirement ×1.5 from L40 |
| Base player | 100 HP, 0 armor, 150 px/s move, 110 px pickup radius, 0 regen |
| Invulnerability after hit | 0.5 s |
| Victory | Alive at 10:00 ("Dawn") |
| Final boss | Arrives at 9:00. Killing it early ends the night at once, with a bonus and a secret check |
| Long Night (optional) | After Dawn you can keep going. The Lantern-Eater hunts you; it is unkillable by design |

### 3.2 Stats (shared by characters, passives and meta)
`Might` (damage %), `Area` (size %), `Duration` (%), `Amount` (+projectiles),
`Cooldown` (−%), `ProjSpeed` (%), `MoveSpeed` (%), `MaxHP`, `Armor` (flat
reduction), `Regen` (HP/s), `Magnet` (pickup radius %), `Luck` (%), `Growth`
(XP %), `Greed` (coins %), `Curse` (enemy HP, speed and spawn rate +%, with more drops),
`Revival` (count).

## 4. Characters

Every character has one **innate** and one **starting weapon**. Innates are
deliberately simple to simulate.

| # | Character | Start weapon | Innate | Base mods | Unlock |
|---|---|---|---|---|---|
| 1 | **Akari**, the Lamplighter | Lantern Flail | **Lanternlight:** enemies inside her light radius (140 px, +5% per 10 levels) take +8% damage. | — | Default |
| 2 | **Ren**, the Exorcist | Ofuda Volley | **Exorcism:** +30% damage to elites and bosses. Elites drop +1 extra Reliquary roll. | −10% MaxHP | Default |
| 3 | **Tetsu**, the Gravedigger | Chain Sickle | **Grave Hunger:** heals 1 HP per 25 kills. | +30 MaxHP, −8% MoveSpeed | Survive to 5:00 with anyone |
| 4 | **Hotaru**, the Moth Child | Spirit Moths | **Flutter:** an active dash (120 px, 0.25 s of i-frames, 6 s cooldown). Shift / Space on keyboard; on-screen button on touch. | +10% MoveSpeed, −20 MaxHP | Evolve any weapon once |
| 5 | ??? **Kagerou**, the Faceless *(secret)* | Mirror Shard | **No Face:** enemy contact damage −35%, and every 60 s a blink makes the nearest elite lose track of you. | MaxHP fixed at 75, +20% Curse | Secret (§9) |
| 6 | ??? **Ido**, the Well Keeper *(secret)* | Koi Spirits | **Undertow:** pickups within 2× magnet radius drift toward you. At 5:00 and 8:00 a flood wave sweeps the screen and damages all enemies for 20% of their max HP. | −15% MoveSpeed | Secret (§9) |

The unlock path takes four to six runs. That is enough to teach the game without
gating the roster for long.

## 5. Arsenal

16 weapons, 16 passives, 16 evolutions and 3 hidden unions.

### 5.0 Reliquaries
Opening one gives, in order of priority: an evolution that is ready (the
first owned weapon at Lv 8 whose paired passive is maxed), else a union
(§5.4), else 1 random level-up of something owned. With Luck it can be 3
(15% × Luck) or 5 (3% × Luck). If nothing can level, it heals 30 HP. Level-up
cards show 3 options, and a 4th with probability (Luck − 1).

### 5.1 Evolution rule
A weapon **evolves** when the weapon is **Lv 8** *and* its paired passive is at
**max level**, and you then open a Reliquary (chest) from an elite or boss. The
evolved weapon replaces the base weapon; the passive stays. Evolution is
announced with a full-screen gold impact frame (§7.4).

### 5.2 Weapons (max Lv 8)
| # | Weapon | Behaviour | Pairs with | Evolution | Evolution effect |
|---|---|---|---|---|---|
| 1 | **Lantern Flail** | A wide arc sweep in the facing direction that alternates sides | Iron Wick | **Sunfall Censer** | Full 360° sweep that leaves burning embers |
| 2 | **Ofuda Volley** | Paper talismans home on the nearest enemy | Ink Well | **Thousand Seals** | Constant stream; sealed enemies freeze for 0.5 s |
| 3 | **Chain Sickle** | A whip that cuts both sides horizontally | Whetstone | **Harvest Moon** | Crescent wave that pierces everything and gives lifesteal on crits |
| 4 | **Spirit Moths** | Moths orbit the player | Burnt Incense | **Moth Lord's Veil** | Orbit never despawns and doubles its radius pulse |
| 5 | **Shrine Bell** | A periodic shockwave ring with knockback | Prayer Beads | **Bell of Last Rites** | Ring executes non-boss enemies under 10% HP |
| 6 | **Salt Circle** | A damaging aura around the player | Pure Water | **Tide of Purification** | Larger aura that heals 0.5 HP per kill inside it |
| 7 | **Kunai Fan** | A fast fan of knives in the move direction | Straw Sandals | **Raven's Rain** | Knife count scales with current speed, and knives rain from above |
| 8 | **Fox Fire** | Flames drop on enemy clusters and burn the ground | Cracked Noh Mask | **Nine-Tailed Inferno** | Nine fires chase enemies |
| 9 | **Paper Crane** | Boomerangs that go out and return | Folded Wind | **Senbazuru** | A ring of cranes spirals outward |
| 10 | **Thunder Drum** | Lightning strikes random on-screen enemies | Lucky Coin | **Endless Storm** | Strikes chain to 3 more targets |
| 11 | **Oil-Paper Parasol** | A spinning parasol that blocks enemy projectiles | Lacquer Mask | **Hundred-Year Parasol** | Reflects projectiles and grants +2 Armor while it spins |
| 12 | **Bone Chimes** | Projectiles that ricochet between enemies | Lodestone | **Ossuary Wind** | Each bounce pulls enemies inward |
| 13 | **Mirror Shard** | A piercing beam toward the densest direction | Candle Stub | **Eye of the Still Pond** | A fan of three beams; kills drop bonus XP |
| 14 | **Incense Burner** | Leaves a trail of slowing, damaging smoke behind you | Rice Ball | **Hungry Ghost Feast** | Smoke spreads, and enemies killed in it sometimes drop food |
| 15 | **Koi Spirits** | Wandering, piercing fish that drift toward enemies | Offering Box | **Dragon Gate** | One koi becomes a dragon that sweeps the screen |
| 16 | **Stone Watchfire** | Places a turret lantern that fires at enemies nearby | Paper Doll | **Keeper of the Dead** | Turrets are permanent, and a turret revives you once per run (in addition to Revival) |

### 5.3 Passives (max Lv 5 unless noted)
| # | Passive | Per level |
|---|---|---|
| 1 | Ink Well | +1 Amount at Lv 1, 3 and 5 |
| 2 | Iron Wick | +8% Area |
| 3 | Burnt Incense | +8% Duration |
| 4 | Pure Water | +0.2 Regen |
| 5 | Straw Sandals | +8% MoveSpeed |
| 6 | Folded Wind | +10% ProjSpeed |
| 7 | Whetstone | +8% Might |
| 8 | Prayer Beads | −6% Cooldown |
| 9 | Lacquer Mask | +1 Armor |
| 10 | Rice Ball | +15 MaxHP |
| 11 | Lodestone | +20% Magnet |
| 12 | Lucky Coin | +8% Luck |
| 13 | Candle Stub | +8% Growth |
| 14 | Offering Box | +10% Greed |
| 15 | Cracked Noh Mask | +8% Curse |
| 16 | Paper Doll (max Lv 2) | +1 Revival per level |

### 5.4 Hidden unions (secret, undocumented in game until discovered)
Unions are rare by design. In the M4 sim (600 runs), Lanternfall formed 8
times and the other two once each.
Two **evolved** weapons in the slots, plus a Reliquary, fuse into one weapon
and free up a slot.
| Union | Ingredients | Effect |
|---|---|---|
| **Lantern Festival** | Moth Lord's Veil + Nine-Tailed Inferno | Burning moths dive at enemies and leave foxfire where they land |
| **Heaven's Toll** | Bell of Last Rites + Endless Storm | Each bell ring calls a lightning ring |
| **Lanternfall** | Sunfall Censer + Eye of the Still Pond, played as **Akari** only | A falling gold lantern-sun every 8 s. The title weapon. |

## 6. Enemies & the night timeline

### 6.1 Roster (original designs)
| Enemy | Role | HP | Speed | Contact dmg | Notes |
|---|---|---|---|---|---|
| **Wisp** | Swarm fodder | 6 | 70 | 4 | Comes in packs of 6–12 |
| **Faceless Walker** | Basic chaser | 18 | 55 | 8 | Blank oval face |
| **Hopping Kasa** | Erratic | 14 | 90 (hops) | 6 | Paper umbrella on one leg; its hops are telegraphed |
| **Drowned** | Tank | 70 | 35 | 14 | Leaves puddles that slow you |
| **Carrion Crow** | Fast flank | 10 | 140 | 6 | Arrives from screen edges in lines |
| **Long-Neck** | Lunger | 40 | 50 | 16 | Telegraphs a 0.6 s neck lunge |
| **Lantern Mouth** | Ranged | 30 | 40 | 6 | Spits slow white orbs, 1 per 3 s |
| **Bride of the Reservoir** *(elite)* | Elite | 900 | 60 | 22 | Veil trail; drops a Reliquary |
| **Bone Colossus** *(miniboss, 5:00)* | Miniboss | 6,000 | 45 | 30 | Ground slam with a ring telegraph |
| **Mother of Lanterns** *(boss, 9:00)* | Boss | 25,000 | 50 | 35 | 3 attack patterns; extinguishes nearby pickups |
| **The Lantern-Eater** *(Long Night)* | Reaper | ∞ | 200+ | 9999 | Appears only after Dawn, or at 10:30 if Long Night is on |

Enemy stats scale per minute (`m`): HP × `(1 + 0.10m + 0.012m²)`, contact
damage × `(1 + 0.05m)`, and XP × `(1 + 0.18m)`. Curse multiplies HP, spawn
budget and XP, and adds half its bonus to move speed.

**Brides (elites, M3 schedule):** 2:30, 4:30 ×2, 6:00, 7:00, 8:00 and 9:00 ×2.
Each drops a Reliquary.

### 6.2 Timeline (initial)
| Time | Spawns | Event |
|---|---|---|
| 0:00–1:00 | Wisps, Walkers | — |
| 1:00–2:00 | + Hopping Kasa | 1:30 Wisp *encirclement* ring |
| 2:00–3:00 | + Crows | 2:30 first **Bride** (elite) |
| 3:00–4:00 | + Drowned | 3:30 Crow line from 2 sides |
| 4:00–5:00 | + Lantern Mouth | 4:30 Bride ×2 |
| 5:00 | **Bone Colossus** | Spawn rate drops while it lives |
| 5:00–7:00 | + Long-Neck; density ×1.6 | 6:00 *Procession*: a wall of Walkers crosses the screen |
| 7:00–9:00 | All types; density ×2.2; Brides every 60 s | 8:00 encirclement ring of Drowned |
| 9:00 | **Mother of Lanterns** | — |
| 10:00 | **Dawn**: victory | Optional Long Night begins |

Spawn director: a per-second **budget** curve. Enemies cost points and spawn
in packs on a ring just outside the visible area (§8.4). 65% of packs spawn
in the half-circle ahead of the player's movement. If fewer than a per-minute
`minAlive` enemies exist, packs spawn regardless of budget. The live-enemy cap
is 500. Enemies further than 1.25× the spawn radius are recycled onto the ring
ahead of the player.

**Anti-kiting rules** (added in M1 after the balance sim showed that running
in a straight line forever was a dominant strategy):
- Chasers **lead** the player. They steer toward where the player will be in
  up to `lead` seconds (per enemy type; wisps 0.5 s, walkers 1 s), scaled by
  distance. Packs ahead of a fleeing player cut off its path.
- **Encirclement rings** spawn as a closed wall at radius 420 (visible), sized
  so there is no gap to slip through. You cut your way out.

All director numbers live in `src/data/director.ts` and `src/data/timeline.ts`.

## 7. Power-ups, pickups & art

### 7.1 Pickups
| Pickup | Source | Effect |
|---|---|---|
| **Spirit Ember** (XP) | Every kill | Value = enemy XP × (1 + 0.18 × minute) × Curse. At most 400 embers exist; when full, the ember furthest from the player is recycled into the new drop, carrying its value, so XP left behind is never stranded. |
| **Onigiri** | Stone lanterns, rare drops | Heals 30 HP |
| **Coin pouch** | Stone lanterns, elites | Meta currency ("Embers of the Shrine"; called *coins* in the UI) |
| **Reliquary** | Elites, bosses | 1 upgrade, or an evolution or union when eligible. Luck can give 3 or 5 upgrades. |

### 7.2 Power-ups (from breakable stone lanterns, about 1 per 45 s on screen)
| Power-up | Effect | Visual |
|---|---|---|
| **Lantern Burst** (screen clear) | Kills every non-elite on screen and deals 30% max HP to elites and bosses | Full white flash, then ink silhouettes shatter |
| **Spirit Call** (magnet) | Pulls every XP ember on the map to you | Gold threads converge on the player |
| **Frenzy: Festival Night** | 10 s: −50% cooldown, +30% MoveSpeed, contact damage halved | Palette inverts to gold-on-black, speed lines, and the music doubles in tempo |

**Implementation (M6).** Data lives in `src/data/powerups.ts`.
- **Stone lanterns:** a lantern is placed every 45 s from 0:20, 260–420 px from the player. At most 3 stand at once.
  - They live in the enemy pool as a stationary `prop` (20 HP, scaled by minute), so every weapon can break them.
  - They never hurt the player, never count as kills, and are cleared once far behind.
- **Drop weights:** coin 32, onigiri 26, Spirit Call 18, Lantern Burst 12, Frenzy 12.
- **Coins:** a pouch holds 3–8. Elites and bosses always drop an 8-coin pouch with their Reliquary.
- **Lantern Burst:** reaches a circle of half the long view side (550 px). That is inside the spawn ring, so enemies still arriving survive in either orientation.
- **Frenzy:** weapon cooldowns tick ×2. The bright tones go gold, faint speed lines run, and the music switches to *Festival*.
- **Reports:** the sim report lists pickups per run and per minute for each character and bot.

### 7.3 Visual direction
**Stark, high-contrast anime.** The world is a near-black ink wash. Every
figure is a white silhouette with very little interior detail. There is exactly
**one accent colour**, lantern gold.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#07070A` | World background |
| `ink-2` | `#121218` | Ground detail, puddles (the only grey tone besides `ash`) |
| `ash` | `#6E6E78` | Telegraphs, UI secondary, decals that fade over time |
| `bone` | `#F2F0EA` | Silhouettes: enemies, player, projectiles, UI text |
| `gold` | `#F5B83D` | **Reserved:** player light, XP embers, evolutions, Frenzy, the focused UI element |

**The gold rule:** gold means *you, or something good for you*. Enemies and
enemy projectiles are never gold. Damage to the player is shown with
**inversion** (bone ↔ ink), not red.

**Original art only.** All sprites are drawn in code from vector paths and
cached to offscreen canvases, or kept as hand-authored SVG in the repo. There
are no downloaded sprites, rips or traced references. Fonts are OFL-licensed and
bundled with their licence file.

#### 7.3.1 Art style target: modern anime × ukiyo-e
By release, every piece of art should read as a **cross between modern anime
and ukiyo-e woodblock prints**. The user supplied two mood references (a
monochrome anime samurai and a colour woodblock-style swordswoman). They set
the *style*: nothing is traced or copied from them.

- **From anime:** clean faces with large dark eyes and sharp highlights, hair as
  bold solid shapes with a few strand cuts, dynamic poses, speed lines, impact
  frames.
- **From ukiyo-e:** confident **variable-width ink outlines** (brush taper:
  thick on the shadow side, thin on the light side), **flat fills** with no
  soft shading, **pattern fills** on cloth (asanoha, seigaiha, kikkō,
  sakura, scattered maple), **bokashi** gradient bands in the sky, stylised
  clouds, waves and ripples, cartouches with vertical text, and a
  hanko-style seal on title and results screens.
- **Print feel in post-FX:** washi paper grain and fibres, slight plate
  misregistration (a 1–2 px offset on the gold plate), ink pooling at line
  ends. These replace generic film grain at `high` quality.
- **Gameplay sprites stay readable first.** At play size, enemies and the
  player keep the bone-on-ink silhouette rule, and get an ink outline plus
  one pattern fill on the largest cloth area. Detailed linework goes where
  the screen gives it room: character portraits (select, results), bosses,
  Reliquary and evolution cut-ins, and the title screen.
- **Palette.** Gameplay keeps `ink`/`bone`/`gold` and the gold rule. Two
  *print tones* are added for illustration and UI ornament only, never for
  gameplay entities: `ai` (deep indigo, for bokashi skies, pattern grounds
  and portrait backdrops) and `shu` (vermilion, for seals, cartouche borders
  and blood spatter in illustrations). `shu` never marks player damage
  (inversion still does).
- **Production.** All art stays code-drawn: Canvas paths baked by
  `SpriteCache`, plus large code-drawn illustrations. Review it on the dev
  sheet at `art.html`.
- **M9 implementation:**
  - **Post-FX:** washi paper (pulp and fibres), an indigo cast in the darks, and a misregistered gold ghost. Only clearly gold pixels count as gold, so bone never picks up a tint.
  - **Sprite finish (`ink.ts`):** a brush-tapered inner keyline and textile motifs (asanoha, seigaiha, kikko, sakura).
    - Figures with hair drop the keyline and give their ink hair a thin rim, because ink on the night ground would vanish.
  - **Characters:** per-character in-play figures (`player-art.ts`) and bust portraits (`portraits.ts`) for the select and results screens.
  - **Enemies:**
    - Hitodama wisp, yurei walker, karakasa and chochin-obake.
    - Bride, Drowned and Long-Neck detail passes.
    - The Mother of Lanterns in an uchikake with a lantern face.
  - **Staging:**
    - Title scene (`title-art.ts`): moon, torii, seigaiha sea, lantern procession, vertical cartouche and seal.
    - Boss cut-in band.
  - **Type:** Shippori Mincho (OFL, bundled) for display text.

### 7.4 Screen effects ("heavy, but switchable")
- **WebGL2 post-FX pass** (`src/render/postfx.ts`): bloom on gold only (a
  warm, bright, saturated mask at quarter resolution), manga **screentone**
  that turns mid tones (the lantern's light falloff, fading decals) into
  halftone dots at a ~4 CSS px pitch, film grain and a vignette.
  **Chromatic aberration** only appears as a brief spike on damage and
  impacts, so the palette stays black, white and gold the rest of the time.
- **Impact frames:** 2–3 frames of full inversion with radial speed lines.
  M2 uses them for encirclement rings, the killing blow and Dawn; evolutions,
  boss arrivals and Lantern Burst join later.
- **Hit-stop:** 60 ms on player damage, 30 ms when 6+ enemies die in one tick,
  300 ms on death. Hit-stop pauses sim stepping in the browser loop. It never
  changes the rules (the sim is bit-identical with or without it).
- **Screen shake:** trauma-based (offset ∝ trauma², linear decay) and capped.
- **Ink:** kill splatters land in bone, decay to `ash` and fade over 9 s
  (ring buffer, max 200).
- **Readability:** the player carries a gold rim and the lantern, the one
  figure with light on it. Enemies flash `ash` when hit.
- **Flash safety:** full-screen flashes are **always** capped at 3 Hz. With
  *Reduce flashing* on, inversions become a soft ash fade, impact frames keep
  only faint speed lines, and the 10 Hz invulnerability blink becomes
  translucency.
- **Settings (pause menu):** Reduce flashing, Screen shake 0–100%, Effects
  High / Low / Off. A first-launch notice offers Reduce flashing before play.
  Settings persist through the versioned save (`src/meta/save.ts`).
- **Quality levels:** High = full post-FX at DPR ≤ 2. Low = no bloom, DPR ≤
  1.25. Off = Canvas2D only (inversion via a `difference` blend, speed lines
  drawn as strokes), DPR ≤ 2. A missing WebGL2 or a lost context falls back
  to Off automatically, with identical gameplay.

## 8. Controls & platforms

### 8.1 Keyboard
WASD or arrows to move. Shift / Space for the character active (Hotaru's dash).
Esc / P to pause. 1–4 or arrows + Enter to pick an upgrade.

### 8.2 Touch
- **Floating joystick:** it appears where the thumb lands in the lower 60% of
  the screen, with a 64 px dead-to-max radius and an 8% dead zone.
- **Action button** (only for characters that have an active) sits in the
  opposite corner, and the pause button sits top-right inside the safe area.
- Upgrade cards are ≥ 64 px tall and use tap-to-select then tap-to-confirm.
  This prevents accidental picks while the player is still holding the joystick.
- Portrait and landscape are both supported, and resizing pauses the game.

### 8.3 Weapons always auto-fire
Aim comes from the facing direction (last move vector) or nearest, densest
targeting, depending on the weapon. There is no manual aim in v1.

### 8.4 Fairness across aspect ratios
The camera shows a **fixed world area** (about 1,100 × 620 world units, rotated
in portrait), scaled to *cover* the screen, so you never see more than that
area. Enemies spawn on a ring at the view's half-diagonal + 40 (≈ 671 units),
outside even the corners. That way phones, portrait players and wide monitors
see the same threat density.

## 9. Meta-progression & secrets

### 9.1 Shrine (meta shop, light)
Spend coins on small permanent ranks: Might, MaxHP, Regen, Cooldown, Area,
Duration, MoveSpeed, Magnet, Luck, Growth, Greed (5 ranks each), Armor
(2 ranks), and the run tools **Reroll**, **Skip** and
**Banish** (3 ranks each). Costs rise per rank, with a full-refund respec.

*M8 calibration:*
- **Per-rank values are small:** for example +1% Might and +3 MaxHP per rank.
- **Amount (+1 projectile) and Revival were cut** (M8 and M10). They were the strongest purchases; with the planner skilled bot dying mostly late in the night, one extra life rescued almost every run. The Paper Doll passive still revives within a run.
- **Measured gain:** with the original values, max meta lifted the skilled bot from about 25% survival to about 100%.
- **Target:** max meta should add about 25 points of survival over the same bot, matching the band midpoints (60% → 85%).
- **Final tuning is at M10**, against the stronger skilled bot.

Total meta power is capped so that a fully upgraded skilled bot sits around
80–90% survival (§10). Meta helps but does not trivialise the game.

### 9.2 Secrets
| Secret | Condition (hidden) | Reward |
|---|---|---|
| **Kagerou** | Reach 8:00 without picking up any Onigiri or being healed by regen (no Pure Water or regen meta) | Unlock character |
| **Ido** | Break the **Sealed Well**, a unique stone lantern that spawns once per run far from the start. Then survive 2:00 with a Drowned-only swarm. | Unlock character |
| **Lantern Festival / Heaven's Toll / Lanternfall** | Hold the ingredients and open a Reliquary | Recorded in the **Lantern Register** (collection). They show as `???` until found. |
| **Kill the Mother before 9:45** | — | A one-time fragment line and a gold frame on the character portrait |

Hints come from cryptic death-screen fragments (for example, *"The well keeper
waits where no lantern was ever lit."*).

**Implementation (M8).** Rules live in `SECRET_RULES` (`src/data/powerups.ts`); reveal text and fragments in `src/data/secrets.ts`.
- **Kagerou:** reach 8:00 with no Onigiri picked up and no regen healing.
- **Ido:**
  - At 2:30 the **Sealed Well** (a 120 HP persistent prop) appears 1100 px from the player, off screen.
  - Breaking it starts a **Flood**: for 2:00 the director spawns only the Drowned.
  - Outlasting the flood alive counts.
- **Dawn early:** the Mother falls before 9:45.
- **Death screen:** shows a hint fragment for an unfound secret 60% of the time, otherwise night lore.
- **Shrine ranks:** `SimConfig.meta` applies them to the stat block, capped at each rank's maximum.
- **Run tools:** Recast, Patience and Exile give `reroll()`, `skip()` and `banish()`; a banished item never appears again that run.
- **Respec:** the Shrine's *Refund all* returns every coin spent.

## 10. Difficulty targets & balance simulation

"Hard on the first try" is defined as **bot survival-rate bands**. These apply
with **no meta upgrades**, per character, over N seeded runs:

| Bot | Behaviour | Target survival to 10:00 |
|---|---|---|
| **Naive** | Moves away from the nearest enemy, picks upgrades at random, ignores pickups | **< 5%** |
| **Average** | Potential-field kiting, a simple priority list for upgrades, grabs XP when safe | **10–25%** |
| **Skilled** | Lookahead steering, plans evolutions, routes for pickups and power-ups, uses actives | **50–70%** |
| **Skilled + max meta** | As above, with every Shrine rank bought | **80–90%** |

Secondary metrics in each report: median death time, level at 5:00 and 10:00,
time to first evolution, damage share per weapon, top killers, lowest HP, and
the pick rate versus win rate of each weapon and passive. Any weapon whose win
rate deviates by more than ±15 points from the median gets flagged.

**Calibration caveat:** bots stand in for humans. After M5 and M10 a short
human playtest checks that "Average bot ≈ first-time player". If it doesn't,
the bands are shifted rather than the bots tuned to match.

## 11. Audio

All audio is synthesized at runtime with WebAudio. There are no sample files.

### 11.1 Procedural music (seeded generative sequencer, 25 ms lookahead scheduler)
Scales: *in* (miyako-bushi), *yo* and *hirajoshi* pentatonics.
Instruments: a Karplus-Strong plucked string (koto-like), a breathy flute
(filtered noise + sine with vibrato), taiko (pitch-dropped sine + noise), FM
temple bells and sub drones.

| Track | Where | Character |
|---|---|---|
| **Paper Moon** | Title / menus | Sparse koto and a bell, 64 BPM, *in* scale |
| **Night Procession** | Run, 0:00–9:00 | 4 intensity layers driven by enemy density and timeline (drone → pulse → taiko → flute lead) |
| **Mother of Lanterns** | Boss | 132 BPM, driving taiko, dissonant bells |
| **Festival Night** | Frenzy overlay | Doubles tempo, with shime-daiko and a gold stinger |
| **Dawn** | Victory | *yo* scale, major-feeling resolution |
| **Ashes** | Death / results | A single drone and a falling plucked line |

### 11.2 SFX
A jsfxr-style parameter synth. Every SFX is a data entry, not a file. Voices are
limited per SFX (for example, max 6 hit sounds per 50 ms) and pitch is
randomised ±5%. Separate Music / SFX / Master sliders. Audio starts on the first
user gesture, as browser autoplay rules require.

## 12. Technical design

### 12.1 Engine choice
**Custom TypeScript engine: Canvas2D world rendering + a thin WebGL2 post-FX
pass.** Phaser was considered and rejected, for three reasons:

1. The headless balance sim must run the *real* game rules in Node, which
   means a renderer-free simulation layer. Phaser couples logic to scenes and
   game objects.
2. Our visuals are silhouettes and screen-space effects, not sprite-sheet-heavy
   scenes, so Phaser's main strengths go unused.
3. A small bundle and full control over the post-FX chain.

### 12.2 Architecture
```
src/
  sim/      Pure, deterministic game rules. No DOM, no window, no Math.random,
            no Date.now. Fixed 60 Hz step. Seeded RNG. Runs in Node and browser.
  data/     Characters, weapons, passives, evolutions, enemies, timeline, sfx,
            music patterns — plain typed objects (data-driven content).
  render/   Canvas2D drawing, sprite cache, camera, particles, WebGL post-FX.
  audio/    WebAudio synth, sequencer, sfx player. Listens to sim events.
  input/    Keyboard + touch → `Intent { move: Vec2, action: boolean, ... }`.
  ui/       DOM overlay: menus, level-up cards, HUD, settings.
  meta/     Save data (versioned localStorage), shop, unlocks, secrets.
  main.ts   Wires it all together.
tools/sim/  Headless runner, bots, report writer (Node, worker_threads).
```
- **Sim → presentation** happens through an **event queue** (`EnemyKilled`,
  `PlayerHit`, `LevelUp` and so on). Render and audio never mutate sim state.
- Bots and humans both produce `Intent`s. The sim cannot tell them apart.
- **Determinism check:** a run (seed + intent log) produces a state hash. CI
  and the sim both assert the hash is stable.
- **Performance:** object pools, a uniform spatial hash grid for collisions,
  pre-rendered sprite caches, devicePixelRatio capped at 2, and dynamic
  resolution scaling when frame time exceeds 18 ms.

### 12.3 Performance budgets
- 60 fps with 500 enemies, 800 player projectiles and 300 embers on a
  mid-range 2022 phone (Chrome, Android) with post-FX at Low.
- Sim step ≤ 4 ms at peak load (desktop) ≤ 8 ms (mobile).
- Headless sim: ≥ 30× real time per worker.
- JS bundle < 250 KB gzipped; zero binary assets except fonts.

### 12.4 Tooling
Vite, TypeScript (strict), Vitest, ESLint and Prettier. `npm run sim` runs the
balance simulation. The build deploys as static files (GitHub Pages compatible,
`base: './'`).

## 13. Out of scope for v1
Multiple stages, online leaderboards, controller support (planned for v1.1), a
manual-aim mode, story cutscenes, and localisation beyond English (strings are
kept in one table so localisation can be added later).

## 14. Milestone plan
`CLAUDE.md` describes the per-milestone workflow (commit plus sim run).

| M | Name | Deliverables | Sim gate at end |
|---|---|---|---|
| **M0** | Scaffold | Vite + TS (strict) in `lanternfall/`, lint, format, Vitest, fixed-step loop, seeded RNG, sim/render split, event queue, `npm run sim` running a stub bot headlessly | Runs; determinism hash stable across 2 runs |
| **M1** | Core loop | Keyboard + floating touch joystick, camera, enemy spawner and timeline (3 enemy types), contact damage, embers, level-up (3 choices), Lantern Flail + Ofuda, death screen. Naive, average and skilled bots. | Report generated; invariants (no NaN, no crash, ≥ 30× real time) |
| **M2** | Look & feel | Procedural silhouette art pipeline, palette tokens, WebGL post-FX (bloom, screentone, grain, vignette, CA), impact frames, hit-stop, shake, ink decals, accessibility toggles, Canvas2D fallback | Sim results **bit-identical** to M1 (rendering must not affect the sim) |
| **M3** | Arsenal I | Stat system, 8 weapons, 8 passives, Reliquaries, evolution framework + 8 evolutions | Weapon damage-share report; no weapon > 60% share |
| **M4** | Arsenal II | Remaining 8 weapons, 8 passives, 8 evolutions, 3 hidden unions | Same as M3, plus every evolution is reached by a skilled bot at least once in 200 runs |
| **M5** | Night & roster | 4 characters + innates (Hotaru's dash in bots), full enemy roster, elites, events, Bone Colossus, Mother of Lanterns, Dawn victory | **Difficulty bands enforced from here** (§10), per character |
| **M6** | Power-ups | Stone lanterns, Lantern Burst, Spirit Call, Frenzy, Onigiri, coins | Bands still hold; power-up pickup rate reported |
| **M7** | Audio | SFX synth + data table, 6 procedural tracks, intensity layers, mixer settings | Bands unchanged (audio is presentation only) |
| **M8** | Meta & secrets | Versioned save, Shrine shop, unlock flow, Kagerou + Ido, Lantern Register, union discovery | Bands for 6 characters; skilled + max meta at 80–90% |
| **M9** | Art pass, UI & mobile polish | Anime × ukiyo-e art pass (§7.3.1): outlined, pattern-filled sprites, character portraits, boss illustrations, washi/misregistration post-FX, title with seal. Title, pause, settings, results, safe areas, orientation handling, dynamic resolution, perf pass on a real phone | Bands unchanged; perf budget measured |
| **M10** | Balance & release | Full sim (200 seeds × bots × characters), tuning, human playtest calibration, production build, Pages deploy | All bands green; no flagged weapons |

Each milestone ends with: tests green → `npm run sim` → report committed to
`sim-reports/M#.md` → a single commit `M#: <name>` (fix-up commits during the
milestone are fine) → push.
