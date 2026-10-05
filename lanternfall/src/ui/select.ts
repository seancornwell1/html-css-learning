import { CHARACTERS, type CharacterDef } from '../data/characters';
import { WEAPONS } from '../data/weapons';

/** Character select (GAME_DESIGN §4): tap-select + tap-confirm, keys 1–4 + Enter. */
export class CharacterSelect {
  private open = false;
  private focused = 0;
  private cards: HTMLButtonElement[] = [];
  private available: CharacterDef[] = [];
  private onPick: (id: string) => void = () => undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly list: HTMLElement,
  ) {
    window.addEventListener('keydown', (e) => this.key(e));
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(
    preselect: string,
    unlocked: (c: CharacterDef) => boolean,
    onPick: (id: string) => void,
  ): void {
    this.onPick = onPick;
    this.available = CHARACTERS.filter((c) => !c.secret || unlocked(c));
    this.focused = Math.max(
      0,
      this.available.findIndex((c) => c.id === preselect),
    );
    this.cards = this.available.map((c, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'char-card';
      const locked = !unlocked(c);
      card.disabled = locked;
      const start = WEAPONS.find((w) => w.id === c.startWeapon)?.name ?? '';
      card.innerHTML =
        '<span class="char-name"></span><span class="char-title"></span>' +
        '<span class="char-innate"><strong></strong> <span></span></span><span class="char-start"></span>';
      (card.querySelector('.char-name') as HTMLElement).textContent = locked ? '???' : c.name;
      (card.querySelector('.char-title') as HTMLElement).textContent = locked ? 'Locked' : c.title;
      (card.querySelector('.char-innate strong') as HTMLElement).textContent = locked
        ? ''
        : c.innateName;
      (card.querySelector('.char-innate span') as HTMLElement).textContent = locked
        ? c.unlock
        : c.innateText;
      (card.querySelector('.char-start') as HTMLElement).textContent = locked
        ? ''
        : `Starts with ${start}`;
      card.addEventListener('click', () => this.tap(i));
      return card;
    });
    this.list.replaceChildren(...this.cards);
    this.root.hidden = false;
    this.open = true;
    this.render(false);
  }

  /** Close without picking (e.g. to visit the Shrine). */
  hide(): void {
    this.open = false;
    this.root.hidden = true;
  }

  private tap(i: number): void {
    if (this.focused === i && this.cards[i]?.classList.contains('selected')) this.pick(i);
    else {
      this.focused = i;
      this.render(true);
    }
  }

  private key(e: KeyboardEvent): void {
    if (!this.open) return;
    const n = this.available.length;
    const digit = Number(e.key);
    if (digit >= 1 && digit <= n) {
      this.focused = digit - 1;
      this.render(true);
    } else if (['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'].includes(e.code)) {
      this.focused = (this.focused + 1) % n;
      this.render(true);
    } else if (['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(e.code)) {
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
    const c = this.available[i];
    if (!c || this.cards[i]?.disabled) return;
    this.open = false;
    this.root.hidden = true;
    this.onPick(c.id);
  }

  private render(selected: boolean): void {
    this.cards.forEach((c, i) => {
      c.classList.toggle('focused', i === this.focused);
      c.classList.toggle('selected', selected && i === this.focused);
    });
    this.cards[this.focused]?.focus();
  }
}
