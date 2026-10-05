import { drawTitleArt } from '../render/title-art';

/**
 * Title screen (GAME_DESIGN §14 M9): the woodblock night scene behind a
 * vertical cartouche with the name and a vermilion seal.
 */
export class TitleScreen {
  private open = false;
  private raf = 0;
  private readonly start = performance.now();

  constructor(
    private readonly root: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.root.hidden = false;
    (this.root.querySelector('button') as HTMLButtonElement | null)?.focus();
    const frame = (): void => {
      if (!this.open) return;
      this.paint();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  hide(): void {
    this.open = false;
    cancelAnimationFrame(this.raf);
    this.root.hidden = true;
  }

  private paint(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(this.root.clientWidth * dpr);
    const h = Math.round(this.root.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const ctx = this.canvas.getContext('2d');
    if (ctx) drawTitleArt(ctx, w, h, (performance.now() - this.start) / 1000);
  }
}
