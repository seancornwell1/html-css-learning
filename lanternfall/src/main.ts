import { FixedStepLoop } from './core/loop';
import { Controller } from './input/controller';
import { KeyboardInput } from './input/keyboard';
import { TouchStick } from './input/touch';
import { Renderer } from './render/renderer';
import type { Intent } from './sim/intent';
import { Sim } from './sim/sim';
import { formatTime } from './ui/format';
import { LevelUpUi } from './ui/levelup';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing`);
  return node as T;
}

const canvas = el<HTMLCanvasElement>('game');
const hudTime = el('hud-time');
const hudLevel = el('hud-level');
const xpFill = el('xp-fill');
const hpFill = el('hp-fill');
const hpBar = el('hp-bar');
const pauseModal = el('pause');
const gameover = el('gameover');

const seedParam = new URLSearchParams(location.search).get('seed');
const newSeed = (): number =>
  seedParam !== null ? Number(seedParam) >>> 0 : Math.floor(Math.random() * 2 ** 32);

const renderer = new Renderer(canvas);
const stick = new TouchStick(canvas, el('stick-base'), el('stick-knob'));
const controller = new Controller(new KeyboardInput(window), stick);
const intent: Intent = { moveX: 0, moveY: 0, action: false };
let sim = new Sim({ seed: newSeed() });
let paused = false;
let lastFrame = performance.now();

const levelUp = new LevelUpUi(el('levelup'), el('levelup-cards'), (i) => sim.choose(i));

function setPaused(value: boolean): void {
  if (sim.status !== 'running' || levelUp.open) value = false;
  paused = value;
  pauseModal.hidden = !value;
  if (value) stick.release();
}

const loop = new FixedStepLoop({
  step() {
    if (paused || levelUp.open) return;
    sim.step(controller.read(intent));
    sim.events.drain((e) => renderer.onEvent(e));
    if (sim.choices && !levelUp.open) {
      stick.release();
      levelUp.show(sim.choices, sim.level);
    }
  },
  render() {
    const now = performance.now();
    renderer.draw(sim, (now - lastFrame) / 1000);
    lastFrame = now;
    // Multiple level-ups in a row: show the next set as soon as one is picked.
    if (sim.choices && !levelUp.open) levelUp.show(sim.choices, sim.level);
    stick.enabled = !levelUp.open && !paused;
    hudTime.textContent = formatTime(sim.time);
    hudLevel.textContent = `Lv ${sim.level}`;
    xpFill.style.width = `${Math.min(100, (sim.xp / sim.xpNext) * 100)}%`;
    const hpPct = Math.max(0, (sim.player.hp / sim.stats.maxHp) * 100);
    hpFill.style.width = `${hpPct}%`;
    hpBar.setAttribute('aria-valuenow', String(Math.round(hpPct)));
    if (sim.status !== 'running' && gameover.hidden) showGameOver();
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
pauseModal.addEventListener('pointerdown', () => setPaused(false));
gameover.addEventListener('pointerdown', restart);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setPaused(true);
    loop.stop();
  } else {
    loop.start();
  }
});

loop.start();
