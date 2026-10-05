import { PASSIVES } from '../data/passives';
import { WEAPONS } from '../data/weapons';

/**
 * The Lantern Register (GAME_DESIGN §9.2): every evolution and hidden union
 * obtained across all runs. Unfound evolutions show their recipe; unfound
 * unions stay `???`.
 */
export class Register {
  private open = false;
  private onClose: () => void = () => undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly list: HTMLElement,
    private readonly found: () => readonly string[],
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
    const found = new Set(this.found());
    const entries = WEAPONS.filter((w) => w.evolvedFrom || w.unionOf);
    const total = entries.length;
    const have = entries.filter((w) => found.has(w.id)).length;
    const head = this.root.querySelector('.register-count');
    if (head) head.textContent = `${have} / ${total} recorded`;
    this.list.replaceChildren(
      ...entries.map((w) => {
        const known = found.has(w.id);
        const row = document.createElement('div');
        row.className = `register-row${known ? ' known' : ''}`;
        const name = document.createElement('span');
        name.className = 'register-name';
        const recipe = document.createElement('span');
        recipe.className = 'register-recipe';
        if (w.unionOf) {
          name.textContent = known ? w.name : '???';
          recipe.textContent = known
            ? `Union of ${w.unionOf.map(weaponName).join(' and ')}`
            : 'A hidden union';
        } else {
          const base = WEAPONS.find((b) => b.id === w.evolvedFrom);
          name.textContent = known ? w.name : '???';
          recipe.textContent = `${weaponName(w.evolvedFrom ?? '')} + ${passiveName(
            base?.evolvePassive ?? '',
          )}`;
        }
        row.append(name, recipe);
        return row;
      }),
    );
    (this.root.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.onClose();
  }
}

function weaponName(id: string): string {
  return WEAPONS.find((w) => w.id === id)?.name ?? id;
}

function passiveName(id: string): string {
  return PASSIVES.find((p) => p.id === id)?.name ?? id;
}
