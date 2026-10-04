import type { UpgradeOption } from '../sim/upgrades';
import { optionDescription, optionLabel } from '../sim/upgrades';
import { WEAPONS } from '../data/weapons';

/** Ignore taps this soon after the cards appear (thumb still on the stick). */
const TAP_GUARD_MS = 350;

/**
 * Level-up cards (GAME_DESIGN §8.2). Keyboard: 1–4 picks, arrows + Enter
 * confirms. Touch/mouse: tap selects, a second tap on the same card confirms.
 */
export class LevelUpUi {
  private options: readonly UpgradeOption[] | null = null;
  private focused = 0;
  private shownAt = 0;
  private readonly cards: HTMLButtonElement[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly list: HTMLElement,
    private readonly onPick: (index: number) => void,
  ) {
    window.addEventListener('keydown', (e) => this.key(e));
  }

  get open(): boolean {
    return this.options !== null;
  }

  show(options: readonly UpgradeOption[], level: number): void {
    this.options = options;
    this.focused = 0;
    this.shownAt = performance.now();
    this.list.replaceChildren();
    this.cards.length = 0;
    const title = this.root.querySelector('.levelup-title');
    if (title) title.textContent = `Level ${level}`;
    options.forEach((o, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      const badge =
        o.type === 'weapon_new' ? 'New' : o.type === 'weapon_level' ? `Lv ${o.toLevel}` : '';
      const kind =
        o.type === 'heal'
          ? 'Mend'
          : WEAPONS[o.weapon]?.behaviour === 'sweep'
            ? 'Weapon · melee'
            : 'Weapon · ranged';
      card.innerHTML = `<span class="card-key">${i + 1}</span><span class="card-badge"></span><strong class="card-name"></strong><span class="card-kind"></span><span class="card-desc"></span>`;
      (card.querySelector('.card-badge') as HTMLElement).textContent = badge;
      (card.querySelector('.card-name') as HTMLElement).textContent = optionLabel(o).replace(
        / Lv \d+$/,
        '',
      );
      (card.querySelector('.card-kind') as HTMLElement).textContent = kind;
      (card.querySelector('.card-desc') as HTMLElement).textContent = optionDescription(o);
      card.addEventListener('click', () => this.tap(i));
      this.cards.push(card);
      this.list.append(card);
    });
    this.root.hidden = false;
    this.render();
  }

  hide(): void {
    this.options = null;
    this.root.hidden = true;
  }

  private tap(i: number): void {
    if (performance.now() - this.shownAt < TAP_GUARD_MS) return;
    if (this.focused === i && this.cards[i]?.classList.contains('selected')) this.pick(i);
    else {
      this.focused = i;
      this.render(true);
    }
  }

  private key(e: KeyboardEvent): void {
    if (!this.options) return;
    const n = this.options.length;
    const digit = Number(e.key);
    if (digit >= 1 && digit <= n) {
      this.pick(digit - 1);
    } else if (
      e.code === 'ArrowDown' ||
      e.code === 'ArrowRight' ||
      e.code === 'KeyS' ||
      e.code === 'KeyD'
    ) {
      this.focused = (this.focused + 1) % n;
      this.render(true);
    } else if (
      e.code === 'ArrowUp' ||
      e.code === 'ArrowLeft' ||
      e.code === 'KeyW' ||
      e.code === 'KeyA'
    ) {
      this.focused = (this.focused + n - 1) % n;
      this.render(true);
    } else if (e.code === 'Enter' || e.code === 'Space') {
      this.pick(this.focused);
    } else {
      return;
    }
    e.preventDefault();
  }

  private pick(i: number): void {
    if (!this.options) return;
    this.hide();
    this.onPick(i);
  }

  private render(selected = false): void {
    this.cards.forEach((c, i) => {
      c.classList.toggle('focused', i === this.focused);
      c.classList.toggle('selected', selected && i === this.focused);
    });
  }
}
