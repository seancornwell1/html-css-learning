import { FixedStepLoop } from './core/loop';
import { Controller } from './input/controller';
import { KeyboardInput } from './input/keyboard';
import { TouchStick } from './input/touch';
import { loadSave, writeSave, type Settings } from './meta/save';
import { Display } from './render/display';
import { Renderer } from './render/renderer';
import type { Intent } from './sim/intent';
import { Sim } from './sim/sim';
import { formatTime } from './ui/format';
import { LevelUpUi } from './ui/levelup';
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
let sim = new Sim({ seed: newSeed() });
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
    if (paused || blocked || levelUp.open) return;
    if (renderer.hitStop.active(performance.now())) return;
    renderer.beforeStep(sim);
    sim.step(controller.read(intent));
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
    stick.enabled = !levelUp.open && !paused && !blocked;
    hudTime.textContent = formatTime(sim.time);
    hudLevel.textContent = `Lv ${sim.level}`;
    xpFill.style.width = `${Math.min(100, (sim.xp / sim.xpNext) * 100)}%`;
    const hpPct = Math.max(0, (sim.player.hp / sim.stats.maxHp) * 100);
    hpFill.style.width = `${hpPct}%`;
    hpBar.setAttribute('aria-valuenow', String(Math.round(hpPct)));
    if (sim.status !== 'running' && gameover.hidden && !renderer.hitStop.active(now)) {
      showGameOver();
    }
  },
});

function showGameOver(): void {
  stick.release();
  el('gameover-title').textContent = sim.status === 'won' ? 'Dawn' : 'The lantern went out';
  el('gameover-stats').textContent =
    `${formatTime(sim.time)} · Level ${sim.level} · ${sim.kills} spirits laid to rest`;
  gameover.hidden = false;
}

function restart(): void {
  if (sim.status === 'running') return;
  sim = new Sim({ seed: newSeed() });
  renderer.reset();
  levelUp.hide();
  gameover.hidden = true;
}

window.addEventListener('resize', () => {
  renderer.resize();
  setPaused(true);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') restart();
  if (e.code === 'Escape' || e.code === 'KeyP') setPaused(!paused);
});
el('pause-btn').addEventListener('click', () => setPaused(!paused));
el('resume-btn').addEventListener('click', () => setPaused(false));
gameover.addEventListener('pointerdown', restart);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setPaused(true);
    loop.stop();
  } else {
    loop.start();
  }
});

if (!settings.noticeSeen && params.get('notice') !== 'skip') {
  blocked = true;
  void showNotice(settings).then(() => {
    blocked = false;
    applySettings(settings);
  });
}

loop.start();
