import { PASSIVES } from '../data/passives';
import { WEAPONS } from '../data/weapons';
import type { Sim } from '../sim/sim';

/** Compact weapon/passive chips; rebuilt only when the loadout changes. */
export class Inventory {
  private key = '';

  constructor(private readonly root: HTMLElement) {}

  update(sim: Sim): void {
    const key =
      sim.weapons.map((w) => `${w.weapon}:${w.level}`).join(',') +
      '|' +
      sim.passives.map((p) => `${p.passive}:${p.level}`).join(',');
    if (key === this.key) return;
    this.key = key;
    const chips: HTMLElement[] = [];
    for (const w of sim.weapons) {
      const def = WEAPONS[w.weapon];
      if (!def) continue;
      const chip = document.createElement('span');
      const special = def.evolvedFrom || def.unionOf;
      chip.className = special ? 'chip evolved' : 'chip';
      chip.textContent = special ? def.name : `${def.name} ${w.level}`;
      chips.push(chip);
    }
    for (const p of sim.passives) {
      const def = PASSIVES[p.passive];
      if (!def) continue;
      const chip = document.createElement('span');
      chip.className = 'chip passive';
      chip.textContent = `${def.name} ${p.level}`;
      chips.push(chip);
    }
    this.root.replaceChildren(...chips);
  }
}

/** Big centred announcement (evolution, reliquary, revive). */
export class Banner {
  private timer = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly title: HTMLElement,
    private readonly detail: HTMLElement,
  ) {}

  show(title: string, detail: string): void {
    this.title.textContent = title;
    this.detail.textContent = detail;
    // Restart the CSS animation.
    this.root.hidden = true;
    void this.root.offsetWidth;
    this.root.hidden = false;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => (this.root.hidden = true), 3000);
  }
}
