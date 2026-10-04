import { FixedStepLoop } from './core/loop';
import { Controller } from './input/controller';
import { KeyboardInput } from './input/keyboard';
import { TouchStick } from './input/touch';
import { loadSave, writeSave, type Settings } from './meta/save';
import { Display } from './render/display';
import { Renderer } from './render/renderer';
import type { Intent } from './sim/intent';
import { CHARACTERS } from './data/characters';
import { ENEMIES } from './data/enemies';
import { Sim } from './sim/sim';
import { formatTime } from './ui/format';
import { Banner, Inventory } from './ui/hud';
import { LevelUpUi } from './ui/levelup';
import { CharacterSelect } from './ui/select';
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
const inventory = new Inventory(el('inventory'));
const banner = new Banner(el('banner'), el('banner-title'), el('banner-detail'));
renderer.onBanner = (title, detail) => banner.show(title, detail);

function applySettings(s: Settings): void {
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
  const s = new Sim({ seed: newSeed(), character });
  if (grant.length > 0) s.grant(grant);
  spawnIds.forEach((id, i) => {
    const kind = ENEMIES.findIndex((d) => d.id === id);
    const a = (i / Math.max(1, spawnIds.length)) * Math.PI * 2;
    if (kind >= 0) s.spawnEnemy(kind, Math.cos(a) * 260, Math.sin(a) * 260, true);
  });
  return s;
}
let sim = newSim();
const select = new CharacterSelect(el('select'), el('select-cards'));
/** Touch dash button held (Hotaru). */
let dashHeld = false;
let paused = false;
let blocked = false; // e.g. the first-launch notice
let lastFrame = performance.now();
/** Smoothed frame time, exposed for tooling (tools/shot.ts). */
let frameMs = 16;

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
    if (paused || blocked || levelUp.open || select.isOpen) return;
    if (renderer.hitStop.active(performance.now())) return;
    renderer.beforeStep(sim);
    controller.read(intent);
    if (dashHeld) intent.action = true;
    sim.step(intent);
    const now = performance.now();
    sim.events.drain((e) => renderer.onEvent(e, now));
    if (sim.choices && !levelUp.open) {
      stick.release();
      levelUp.show(sim.choices, sim.level);
    }
  },
  render(alpha) {
    const now = performance.now();
    const frozen = paused || blocked || levelUp.open || renderer.hitStop.active(now);
    renderer.draw(sim, frozen ? 1 : alpha, (now - lastFrame) / 1000);
    frameMs += (now - lastFrame - frameMs) * 0.05;
    (window as { __frameMs?: number }).__frameMs = frameMs;
    lastFrame = now;
    // Multiple level-ups in a row: show the next set as soon as one is picked.
    if (sim.choices && !levelUp.open) levelUp.show(sim.choices, sim.level);
    stick.enabled = !levelUp.open && !paused && !blocked && !select.isOpen;
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
  el('gameover-stats').textContent =
    `${formatTime(sim.time)} · Level ${sim.level} · ${sim.kills} spirits laid to rest`;
  el('longnight-btn').hidden = !won;
  gameover.hidden = false;
  el('again-btn').focus();
}

function restart(): void {
  sim = newSim();
  renderer.reset();
  levelUp.hide();
  gameover.hidden = true;
}

function chooseCharacter(): void {
  gameover.hidden = true;
  stick.release();
  select.show(
    character,
    () => true,
    (id) => {
      character = id;
      save.profile.lastCharacter = id;
      writeSave(save);
      sim = newSim();
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
  if (document.hidden) {
    setPaused(true);
    loop.stop();
  } else {
    loop.start();
  }
});

const startSelect = (): void => {
  if (!charParam) chooseCharacter();
};
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
