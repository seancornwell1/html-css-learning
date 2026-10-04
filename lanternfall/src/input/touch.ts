/**
 * Floating virtual joystick (GAME_DESIGN §8.2): it appears where the thumb
 * lands in the lower 60% of the screen. 64 px from centre is full tilt, with
 * an 8% dead zone.
 */
const MAX_RADIUS = 64;
const DEAD_ZONE = 0.08;
const ACTIVE_TOP = 0.4;

export class TouchStick {
  x = 0;
  y = 0;
  enabled = true;
  private pointerId = -1;
  private originX = 0;
  private originY = 0;

  constructor(
    target: HTMLElement,
    private readonly base: HTMLElement,
    private readonly knob: HTMLElement,
  ) {
    target.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('blur', () => this.release());
  }

  get active(): boolean {
    return this.pointerId >= 0;
  }

  release(): void {
    this.pointerId = -1;
    this.x = 0;
    this.y = 0;
    this.base.hidden = true;
  }

  private down(e: PointerEvent): void {
    if (!this.enabled || this.active || e.clientY < window.innerHeight * ACTIVE_TOP) return;
    this.pointerId = e.pointerId;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.hidden = false;
    e.preventDefault();
  }

  private move(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    let dx = e.clientX - this.originX;
    let dy = e.clientY - this.originY;
    const len = Math.hypot(dx, dy);
    if (len > MAX_RADIUS) {
      dx = (dx / len) * MAX_RADIUS;
      dy = (dy / len) * MAX_RADIUS;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const tilt = Math.min(len, MAX_RADIUS) / MAX_RADIUS;
    if (tilt < DEAD_ZONE) {
      this.x = 0;
      this.y = 0;
    } else {
      this.x = dx / MAX_RADIUS;
      this.y = dy / MAX_RADIUS;
    }
  }

  private up(e: PointerEvent): void {
    if (e.pointerId === this.pointerId) this.release();
  }
}
