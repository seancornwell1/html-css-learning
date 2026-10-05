import type { UpgradeOption } from '../sim/upgrades';
import { optionDescription, optionLabel } from '../sim/upgrades';
import { PASSIVES } from '../data/passives';
import { WEAPONS } from '../data/weapons';

const MELEE = new Set(['sweep', 'whip', 'nova', 'aura', 'parasol']);

function cardKind(o: UpgradeOption): string {
  switch (o.type) {
    case 'heal':
      return 'Mend';
    case 'passive_new':
    case 'passive_level':
      return 'Passive';
    default: {
      const def = WEAPONS[o.weapon];
      const evo = def?.evolvePassive ? ` · evolves with ${passiveName(def.evolvePassive)}` : '';
      return `Weapon · ${MELEE.has(def?.behaviour ?? '') ? 'close' : 'ranged'}${evo}`;
    }
  }
}

function passiveName(id: string): string {
  return PASSIVES.find((p) => p.id === id)?.name ?? id;
}

/** Run tools bought at the Shrine (GAME_DESIGN §9.1). */
export interface LevelUpTools {
  rerolls: number;
  skips: number;
  banishes: number;
  reroll(): void;
  skip(): void;
  banish(index: number): void;
}

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
  private tools: LevelUpTools | null = null;
  /** Next card tap/key banishes instead of picking. */
  private banishing = false;

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

  show(options: readonly UpgradeOption[], level: number, tools?: LevelUpTools): void {
    this.options = options;
    this.tools = tools ?? null;
    this.banishing = false;
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
        o.type === 'weapon_new' || o.type === 'passive_new'
          ? 'New'
          : o.type === 'weapon_level' || o.type === 'passive_level'
            ? `Lv ${o.toLevel}`
            : '';
      const kind = cardKind(o);
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
    this.renderTools();
    this.root.hidden = false;
    this.render();
  }

  private renderTools(): void {
    let row = this.root.querySelector<HTMLElement>('.levelup-tools');
    if (!row) {
      row = document.createElement('div');
      row.className = 'levelup-tools actions';
      this.list.after(row);
    }
    const t = this.tools;
    const buttons: HTMLButtonElement[] = [];
    const add = (label: string, count: number, key: string, run: () => void): void => {
      if (count <= 0) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn secondary';
      b.textContent = `${label} ${count} · ${key}`;
      b.addEventListener('click', run);
      buttons.push(b);
    };
    if (t) {
      add('Reroll', t.rerolls, 'R', () => this.useReroll());
      add('Skip', t.skips, 'X', () => this.useSkip());
      add(this.banishing ? 'Banish: pick a card' : 'Banish', t.banishes, 'B', () =>
        this.toggleBanish(),
      );
    }
    row.replaceChildren(...buttons);
    row.hidden = buttons.length === 0;
  }

  private useReroll(): void {
    const t = this.tools;
    if (!t || t.rerolls <= 0) return;
    this.hide();
    t.reroll();
  }

  private useSkip(): void {
    const t = this.tools;
    if (!t || t.skips <= 0) return;
    this.hide();
    t.skip();
  }

  private toggleBanish(): void {
    if (!this.tools || this.tools.banishes <= 0) return;
    this.banishing = !this.banishing;
    this.root.classList.toggle('banishing', this.banishing);
    this.renderTools();
  }

  hide(): void {
    this.options = null;
    this.banishing = false;
    this.root.classList.remove('banishing');
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
    } else if (e.code === 'KeyR') {
      this.useReroll();
    } else if (e.code === 'KeyX') {
      this.useSkip();
    } else if (e.code === 'KeyB') {
      this.toggleBanish();
    } else {
      return;
    }
    e.preventDefault();
  }

  private pick(i: number): void {
    if (!this.options) return;
    const tools = this.tools;
    const banish = this.banishing && tools !== null && tools.banishes > 0;
    this.hide();
    if (banish) tools.banish(i);
    else this.onPick(i);
  }

  private render(selected = false): void {
    this.cards.forEach((c, i) => {
      c.classList.toggle('focused', i === this.focused);
      c.classList.toggle('selected', selected && i === this.focused);
    });
  }
}
