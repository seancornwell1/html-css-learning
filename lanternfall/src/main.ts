import { FixedStepLoop } from './core/loop';
import { KeyboardInput } from './input/keyboard';
import { Renderer } from './render/renderer';
import type { Intent } from './sim/intent';
import { Sim } from './sim/sim';
import { formatTime } from './ui/format';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing`);
  return node as T;
}

const canvas = el<HTMLCanvasElement>('game');
const hudTime = el('hud-time');
const hudHp = el('hud-hp');
const overlay = el('overlay');
const overlayTitle = el('overlay-title');

const seedParam = new URLSearchParams(location.search).get('seed');
const newSeed = (): number =>
  seedParam !== null ? Number(seedParam) >>> 0 : Math.floor(Math.random() * 2 ** 32);

const renderer = new Renderer(canvas);
const keyboard = new KeyboardInput(window);
const intent: Intent = { moveX: 0, moveY: 0, action: false };
let sim = new Sim({ seed: newSeed() });
let lastFrame = performance.now();

const loop = new FixedStepLoop({
  step() {
    sim.step(keyboard.read(intent));
    sim.events.drain((e) => renderer.onEvent(e));
  },
  render() {
    const now = performance.now();
    renderer.draw(sim, (now - lastFrame) / 1000);
    lastFrame = now;
    hudTime.textContent = formatTime(sim.time);
    hudHp.textContent = String(Math.ceil(sim.player.hp));
    if (sim.status !== 'running' && overlay.hidden) {
      overlayTitle.textContent = sim.status === 'won' ? 'DAWN' : 'THE LANTERN WENT OUT';
      overlay.hidden = false;
    }
  },
});

function restart(): void {
  if (sim.status === 'running') return;
  sim = new Sim({ seed: newSeed() });
  overlay.hidden = true;
}

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') restart();
});
overlay.addEventListener('pointerdown', restart);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});

loop.start();
