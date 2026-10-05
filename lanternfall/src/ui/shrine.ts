import { SHRINE, rankCost, type ShrineRank } from '../data/meta';
import type { Profile } from '../meta/save';

/**
 * The Shrine (GAME_DESIGN §9.1): spend coins on permanent ranks between
 * runs. Purchases write straight to the profile; `onChange` persists it.
 */
export class Shrine {
  private open = false;
  private onClose: () => void = () => undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly list: HTMLElement,
    private readonly coinsLabel: HTMLElement,
    private readonly profile: Profile,
    private readonly onChange: () => void,
  ) {
    window.addEventListener('keydown', (e) => {
      if (this.open && e.code === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(onClose: () => void): void {
    this.onClose = onClose;
    this.open = true;
    this.root.hidden = false;
    this.render();
    (this.list.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.onClose();
  }

  private buy(def: ShrineRank): void {
    const rank = this.profile.ranks[def.id] ?? 0;
    if (rank >= def.maxRank) return;
    const cost = rankCost(def, rank);
    if (this.profile.coins < cost) return;
    this.profile.coins -= cost;
    this.profile.ranks[def.id] = rank + 1;
    this.onChange();
    this.render(def.id);
  }

  private render(focusId?: string): void {
    this.coinsLabel.textContent = `${this.profile.coins} coins`;
    const rows = SHRINE.map((def) => {
      const rank = this.profile.ranks[def.id] ?? 0;
      const maxed = rank >= def.maxRank;
      const cost = maxed ? 0 : rankCost(def, rank);
      const row = document.createElement('div');
      row.className = 'shrine-row';
      const info = document.createElement('div');
      info.className = 'shrine-info';
      const name = document.createElement('span');
      name.className = 'shrine-name';
      name.textContent = def.name;
      const text = document.createElement('span');
      text.className = 'shrine-text';
      text.textContent = def.text;
      const pips = document.createElement('span');
      pips.className = 'shrine-pips';
      pips.setAttribute('aria-label', `Rank ${rank} of ${def.maxRank}`);
      pips.textContent = '●'.repeat(rank) + '○'.repeat(def.maxRank - rank);
      info.append(name, text, pips);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn shrine-buy';
      btn.dataset.id = def.id;
      btn.textContent = maxed ? 'Full' : `${cost}`;
      btn.disabled = maxed || this.profile.coins < cost;
      btn.setAttribute(
        'aria-label',
        maxed ? `${def.name}: full` : `Buy ${def.name} for ${cost} coins`,
      );
      btn.addEventListener('click', () => this.buy(def));
      row.append(info, btn);
      return row;
    });
    this.list.replaceChildren(...rows);
    if (focusId) {
      const again = this.list.querySelector<HTMLButtonElement>(`button[data-id="${focusId}"]`);
      (again && !again.disabled
        ? again
        : this.list.querySelector<HTMLButtonElement>('button:not([disabled])')
      )?.focus();
    }
  }
}
