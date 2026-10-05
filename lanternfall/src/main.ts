import '@fontsource/shippori-mincho/latin-400.css';
import '@fontsource/shippori-mincho/latin-700.css';
import { FixedStepLoop } from './core/loop';
import { Controller } from './input/controller';
import { KeyboardInput } from './input/keyboard';
import { TouchStick } from './input/touch';
import { AudioDirector } from './audio/director';
import { loadSave, writeSave, type Settings } from './meta/save';
import { Display, ResolutionGovernor } from './render/display';
import { portraitCanvas } from './render/portraits';
import { Renderer } from './render/renderer';
import type { Intent } from './sim/intent';
import { CHARACTERS } from './data/characters';
import { ENEMIES } from './data/enemies';
import { WEAPONS } from './data/weapons';
import { Sim } from './sim/sim';
import { formatTime } from './ui/format';
import { Banner, Inventory } from './ui/hud';
import { LevelUpUi, type LevelUpTools } from './ui/levelup';
import { FRAGMENTS, SECRETS } from './data/secrets';
import { CharacterSelect } from './ui/select';
import { Shrine } from './ui/shrine';
import { Register } from './ui/register';
import { TitleScreen } from './ui/title';
import { runPayout } from './data/meta';
import { bindSettings, showNotice } from './ui/settings-ui';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing`);
  return node as T;
}

const stage = el('stage');
const hudTime = el('hud-time');
const hudLevel = el('hud-level');
const xpFill = el('xp-fill');
const hpFill = el('hp-fill');
const hpBar = el('hp-bar');
const pauseModal = el('pause');
const gameover = el('gameover');
const bossBar = el('boss-bar');
const bossFill = el('boss-fill');
const dashBtn = el<HTMLButtonElement>('dash-btn');

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const newSeed = (): number =>
  seedParam !== null ? Number(seedParam) >>> 0 : Math.floor(Math.random() * 2 ** 32);

const save = loadSave();
const settings = save.settings;
// ?fx=off|low|high overrides for testing without touching the save.
const fxParam = params.get('fx');
const display = new Display(stage);
settings.effects = display.setQuality(
  fxParam === 'off' || fxParam === 'low' || fxParam === 'high' ? fxParam : settings.effects,
);
const renderer = new Renderer(display);
const governor = new ResolutionGovernor();
const inventory = new Inventory(el('inventory'));
const banner = new Banner(el('banner'), el('banner-title'), el('banner-detail'));
renderer.onBanner = (title, detail) => banner.show(title, detail);

const audio = new AudioDirector();
// Browsers only allow audio after a gesture; any press/tap/key unlocks it.
for (const ev of ['pointerdown', 'touchend', 'keydown'] as const) {
  window.addEventListener(ev, () => audio.unlock(), { capture: true });
}

function applySettings(s: Settings): void {
  audio.setVolumes(s.volMaster, s.volMusic, s.volSfx);
  renderer.reduceFlashing = s.reduceFlashing;
  renderer.shake.scale = s.shake;
  if (s.effects !== display.quality) {
    s.effects = display.setQuality(s.effects);
    renderer.resize();
  }
  writeSave(save);
}
applySettings(settings);
bindSettings(settings, applySettings);

const stick = new TouchStick(stage, el('stick-base'), el('stick-knob'));
const controller = new Controller(new KeyboardInput(window), stick);
const intent: Intent = { moveX: 0, moveY: 0, action: false };
/** `?grant=fox_fire:8,iron_wick:5` gives a debug loadout to every new run. */
const grant = (params.get('grant') ?? '')
  .split(',')
  .filter(Boolean)
  .map((part) => {
    const [id, level] = part.split(':');
    return { id: id ?? '', level: Math.max(1, Number(level ?? 1) || 1) };
  });
const charParam = params.get('char');
let character =
  charParam && CHARACTERS.some((c) => c.id === charParam) ? charParam : save.profile.lastCharacter;
/** `?spawn=bone_colossus,long_neck` places debug enemies near the start. */
const spawnIds = (params.get('spawn') ?? '').split(',').filter(Boolean);
function newSim(): Sim {
  const s = new Sim({ seed: newSeed(), character, meta: save.profile.ranks });
  if (grant.length > 0) s.grant(grant);
  spawnIds.forEach((id, i) => {
    const kind = ENEMIES.findIndex((d) => d.id === id);
    const a = (i / Math.max(1, spawnIds.length)) * Math.PI * 2;
    if (kind >= 0) s.spawnEnemy(kind, Math.cos(a) * 260, Math.sin(a) * 260, true);
  });
  return s;
}
let sim = newSim();
// Debug: ?debug exposes live state to test scripts (read-only use).
if (params.has('debug')) {
  Object.defineProperty(window, '__lf', {
    value: {
      get sim() {
        return sim;
      },
      get intent() {
        return intent;
      },
      get stick() {
        return stick;
      },
    },
  });
}
// Debug: ?evolve=<weapon id> plays the evolution cut-in.
const evolveParam = params.get('evolve');
if (evolveParam) {
  const weapon = WEAPONS.findIndex((w) => w.id === evolveParam);
  if (weapon >= 0) renderer.onEvent({ type: 'evolution', weapon, union: false }, performance.now());
}
// Debug: spawned bosses still get their cut-in.
for (const id of spawnIds) {
  const kind = ENEMIES.findIndex((d) => d.id === id);
  if (ENEMIES[kind]?.boss) renderer.onEvent({ type: 'boss', kind }, performance.now());
}
const select = new CharacterSelect(el('select'), el('select-cards'));
const shrine = new Shrine(el('shrine'), el('shrine-list'), el('shrine-coins'), save.profile, () =>
  writeSave(save),
);
const title = new TitleScreen(el('title'), el<HTMLCanvasElement>('title-art'));
const register = new Register(el('register'), el('register-list'), () => save.profile.register);
/** What this run has already paid out (the Long Night pays only the rest). */
const paid = { time: 0, kills: 0, coins: 0, won: false };
/** Touch dash button held (Hotaru). */
let dashHeld = false;
let paused = false;
let blocked = false; // e.g. the first-launch notice
let lastFrame = performance.now();
/** Smoothed frame time, exposed for tooling (tools/shot.ts). */
let frameMs = 16;

/** Shrine run tools for the level-up screen; reads the live sim. */
const runTools: LevelUpTools = {
  get rerolls() {
    return sim.rerolls;
  },
  get skips() {
    return sim.skips;
  },
  get banishes() {
    return sim.banishes;
  },
  reroll: () => void sim.reroll(),
  skip: () => void sim.skip(),
  banish: (i) => void sim.banish(i),
};

const levelUp = new LevelUpUi(el('levelup'), el('levelup-cards'), (i) => sim.choose(i));

function setPaused(value: boolean): void {
  if (sim.status !== 'running' || levelUp.open || blocked) value = false;
  paused = value;
  pauseModal.hidden = !value;
  if (value) {
    stick.release();
    el('resume-btn').focus();
  }
}

const loop = new FixedStepLoop({
  step() {
    if (
      paused ||
      blocked ||
      levelUp.open ||
      select.isOpen ||
      shrine.isOpen ||
      register.isOpen ||
      title.isOpen
    )
      return;
    if (renderer.hitStop.active(performance.now())) return;
    renderer.beforeStep(sim);
    controller.read(intent);
    if (dashHeld) intent.action = true;
    sim.step(intent);
    const now = performance.now();
    sim.events.drain((e) => {
      renderer.onEvent(e, now);
      audio.onEvent(e);
    });
    if (sim.choices && !levelUp.open) {
      stick.release();
      levelUp.show(sim.choices, sim.level, runTools);
    }
  },
  render(alpha) {
    const now = performance.now();
    const frozen = paused || blocked || levelUp.open || renderer.hitStop.active(now);
    renderer.draw(sim, frozen ? 1 : alpha, (now - lastFrame) / 1000);
    frameMs += (now - lastFrame - frameMs) * 0.05;
    // Headless/automation runs use software GL; never downscale there.
    if (!navigator.webdriver && governor.update(display, frameMs, (now - lastFrame) / 1000)) {
      renderer.resize();
    }
    (window as { __frameMs?: number }).__frameMs = frameMs;
    lastFrame = now;
    // Multiple level-ups in a row: show the next set as soon as one is picked.
    if (sim.choices && !levelUp.open) levelUp.show(sim.choices, sim.level, runTools);
    stick.enabled =
      !levelUp.open &&
      !paused &&
      !blocked &&
      !select.isOpen &&
      !shrine.isOpen &&
      !register.isOpen &&
      !title.isOpen;
    audio.menu = select.isOpen || shrine.isOpen || register.isOpen || title.isOpen || blocked;
    audio.update(sim);
    updateBossBar();
    dashBtn.hidden = sim.characterDef.innate !== 'flutter' || select.isOpen;
    dashBtn.classList.toggle('cooling', sim.dashCooldown > 0);
    hudTime.textContent = formatTime(sim.time);
    hudLevel.textContent = `Lv ${sim.level}`;
    inventory.update(sim);
    xpFill.style.width = `${Math.min(100, (sim.xp / sim.xpNext) * 100)}%`;
    const hpPct = Math.max(0, (sim.player.hp / sim.stats.maxHp) * 100);
    hpFill.style.width = `${hpPct}%`;
    hpBar.setAttribute('aria-valuenow', String(Math.round(hpPct)));
    if (sim.status !== 'running' && gameover.hidden && !renderer.hitStop.active(now)) {
      showGameOver();
    }
  },
});

function updateBossBar(): void {
  const e = sim.enemies;
  let best = -1;
  for (let i = 0; i < e.count; i++) {
    const s = e.slots[i] as number;
    const def = ENEMIES[e.kind[s] as number];
    if (def?.boss && !def.invulnerable) best = s;
  }
  bossBar.hidden = best < 0;
  if (best < 0) return;
  el('boss-name').textContent = ENEMIES[e.kind[best] as number]?.name ?? '';
  bossFill.style.width = `${Math.max(0, ((e.hp[best] as number) / (e.maxHp[best] as number)) * 100)}%`;
}

function showGameOver(): void {
  stick.release();
  const won = sim.status === 'won';
  el('gameover-title').textContent = won
    ? sim.motherSlain
      ? 'Dawn, early'
      : 'Dawn'
    : sim.longNight
      ? 'Eaten by the night'
      : 'The lantern went out';
  const earned = settleRun(won);
  el('gameover-stats').textContent =
    `${formatTime(sim.time)} · Level ${sim.level} · ${sim.kills} spirits laid to rest · ` +
    `+${earned} coins`;
  el('gameover-fragment').textContent = pickFragment();
  const art = portraitCanvas(sim.character, 112, 140);
  art.classList.toggle('golden', save.profile.secrets.includes('dawn_early'));
  el('gameover-portrait').replaceChildren(art);
  el('longnight-btn').hidden = !won;
  gameover.hidden = false;
  el('again-btn').focus();
}

/**
 * Bank coins and progress at the end of a run (GAME_DESIGN §9). Called once
 * per ending; after a Long Night only the extra time, kills and coins pay.
 */
function settleRun(won: boolean): number {
  const pr = save.profile;
  const firstWin = won && !paid.won;
  const earned =
    runPayout(sim.time - paid.time, sim.kills - paid.kills, firstWin) +
    Math.floor(sim.coins - paid.coins);
  if (paid.time === 0) pr.stats.runs++;
  if (firstWin) pr.stats.wins++;
  pr.stats.kills += sim.kills - paid.kills;
  pr.stats.bestTime = Math.max(pr.stats.bestTime, sim.time);
  pr.coins += earned;
  Object.assign(paid, { time: sim.time, kills: sim.kills, coins: sim.coins, won: paid.won || won });
  // Unlocks (GAME_DESIGN §4): Tetsu by surviving 5:00, Hotaru by evolving.
  const unlock = (id: string): void => {
    if (!pr.unlocked.includes(id)) pr.unlocked.push(id);
  };
  if (sim.time >= 300) unlock('tetsu');
  if (sim.evolutions.length > 0) unlock('hotaru');
  for (const e of sim.evolutions) if (!pr.register.includes(e.weapon)) pr.register.push(e.weapon);
  for (const id of sim.secrets) {
    if (!pr.secrets.includes(id)) pr.secrets.push(id);
    const unlocks = SECRETS.find((x) => x.id === id)?.unlocks;
    if (unlocks) unlock(unlocks);
  }
  writeSave(save);
  return earned;
}

/**
 * A death-screen fragment (GAME_DESIGN §9.2): usually a hint toward a
 * secret not yet found, otherwise night lore. Presentation-only randomness.
 */
function pickFragment(): string {
  const found = save.profile.secrets;
  const hints = FRAGMENTS.filter((f) => f.hint && !found.includes(f.hint));
  const pool = hints.length > 0 && Math.random() < 0.6 ? hints : FRAGMENTS.filter((f) => !f.hint);
  return pool[Math.floor(Math.random() * pool.length)]?.text ?? '';
}

function restart(): void {
  sim = newSim();
  Object.assign(paid, { time: 0, kills: 0, coins: 0, won: false });
  renderer.reset();
  levelUp.hide();
  gameover.hidden = true;
}

function chooseCharacter(): void {
  gameover.hidden = true;
  stick.release();
  select.show(
    character,
    (c) => save.profile.unlocked.includes(c.id),
    (id) => {
      character = id;
      save.profile.lastCharacter = id;
      writeSave(save);
      sim = newSim();
      Object.assign(paid, { time: 0, kills: 0, coins: 0, won: false });
      renderer.reset();
      levelUp.hide();
    },
  );
}

window.addEventListener('resize', () => {
  renderer.resize();
  setPaused(true);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && !gameover.hidden) restart();
  if (e.code === 'Escape' || e.code === 'KeyP') setPaused(!paused);
});
el('pause-btn').addEventListener('click', () => setPaused(!paused));
el('resume-btn').addEventListener('click', () => setPaused(false));
el('again-btn').addEventListener('click', restart);
el('change-btn').addEventListener('click', chooseCharacter);
el('shrine-btn').addEventListener('click', () => {
  select.hide();
  shrine.show(() => chooseCharacter());
});
el('shrine-close').addEventListener('click', () => shrine.close());
el('shrine-refund').addEventListener('click', () => shrine.refund());
el('register-btn').addEventListener('click', () => {
  select.hide();
  register.show(() => chooseCharacter());
});
el('register-close').addEventListener('click', () => register.close());
el('longnight-btn').addEventListener('click', () => {
  sim.continueLongNight();
  gameover.hidden = true;
});
dashBtn.addEventListener('pointerdown', (e) => {
  dashHeld = true;
  e.preventDefault();
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
  dashBtn.addEventListener(ev, () => (dashHeld = false));
}
document.addEventListener('visibilitychange', () => {
  audio.engine.suspend(document.hidden);
  if (document.hidden) {
    setPaused(true);
    loop.stop();
  } else {
    loop.start();
  }
});

const startSelect = (): void => {
  if (!charParam) title.show();
};
el('title-begin').addEventListener('click', () => {
  title.hide();
  chooseCharacter();
});
el('title-shrine').addEventListener('click', () => {
  title.hide();
  shrine.show(() => title.show());
});
el('title-register').addEventListener('click', () => {
  title.hide();
  register.show(() => title.show());
});
if (!settings.noticeSeen && params.get('notice') !== 'skip') {
  blocked = true;
  void showNotice(settings).then(() => {
    blocked = false;
    applySettings(settings);
    startSelect();
  });
} else {
  startSelect();
}

loop.start();
