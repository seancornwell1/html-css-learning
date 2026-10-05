import { SpriteCache, type Sprite } from '../render/sprites';
import { portraitCanvas } from '../render/portraits';

/**
 * Dev-only art sheet (`npm run dev`, then /art.html?scale=6): every baked
 * sprite at a large scale, for reviewing the woodblock finish. Not part of
 * the production build.
 */
const params = new URLSearchParams(location.search);
const scale = Number(params.get('scale') ?? 6);
const sheet = document.getElementById('sheet') as HTMLElement;
const cache = new SpriteCache();
cache.build(scale);

function show(label: string, sprite: Sprite | undefined): void {
  if (!sprite) return;
  const fig = document.createElement('figure');
  const c = document.createElement('canvas');
  c.width = sprite.canvas.width;
  c.height = sprite.canvas.height;
  c.getContext('2d')?.drawImage(sprite.canvas, 0, 0);
  const cap = document.createElement('figcaption');
  cap.textContent = label;
  fig.append(c, cap);
  sheet.append(fig);
}

show('player', cache.player[0]);
for (const [id, tints] of cache.enemy) show(id, tints[0]?.[0]);

for (const id of ['akari', 'ren', 'tetsu', 'hotaru', 'kagerou', 'ido']) {
  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption');
  cap.textContent = id;
  fig.append(portraitCanvas(id, 240, 300), cap);
  sheet.append(fig);
}
