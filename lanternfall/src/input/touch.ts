/**
 * Floating virtual joystick (GAME_DESIGN §8.2): it appears where the thumb
 * lands in the lower 60% of the screen. 64 px from centre is full tilt, with
 * an 8% dead zone.
 *
 * Touch devices use Touch Events with `preventDefault` (non-passive): iOS
 * Safari can cancel a Pointer Events drag mid-gesture when it decides the
 * touch is a pan, which would release the stick the moment the thumb moves.
 * Mouse and pen use Pointer Events.
 */
const MAX_RADIUS = 64;
const DEAD_ZONE = 0.08;
const ACTIVE_TOP = 0.4;
/** Id used for the mouse/pen path (touch identifiers are >= 0). */
const POINTER = -2;

export class TouchStick {
  x = 0;
  y = 0;
  enabled = true;
  /** Active touch identifier, POINTER for mouse/pen, -1 when idle. */
  private id = -1;
  private pointerId = -1;
  private originX = 0;
  private originY = 0;

  constructor(
    target: HTMLElement,
    private readonly base: HTMLElement,
    private readonly knob: HTMLElement,
  ) {
    const opts = { passive: false } as const;
    target.addEventListener('touchstart', (e) => this.touchStart(e), opts);
    window.addEventListener('touchmove', (e) => this.touchMove(e), opts);
    window.addEventListener('touchend', (e) => this.touchEnd(e), opts);
    window.addEventListener('touchcancel', (e) => this.touchEnd(e), opts);
    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return; // handled by touch events
      if (this.begin(POINTER, e.clientX, e.clientY)) {
        this.pointerId = e.pointerId;
        e.preventDefault();
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (this.id === POINTER && e.pointerId === this.pointerId) this.drag(e.clientX, e.clientY);
    });
    const pointerUp = (e: PointerEvent): void => {
      if (this.id === POINTER && e.pointerId === this.pointerId) this.release();
    };
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    window.addEventListener('blur', () => this.release());
  }

  get active(): boolean {
    return this.id !== -1;
  }

  release(): void {
    this.id = -1;
    this.pointerId = -1;
    this.x = 0;
    this.y = 0;
    this.base.hidden = true;
  }

  private touchStart(e: TouchEvent): void {
    if (this.active) return;
    const t = e.changedTouches[0];
    if (t && this.begin(t.identifier, t.clientX, t.clientY)) e.preventDefault();
  }

  private touchMove(e: TouchEvent): void {
    if (!this.active || this.id === POINTER) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.id) {
        this.drag(t.clientX, t.clientY);
        e.preventDefault();
      }
    }
  }

  private touchEnd(e: TouchEvent): void {
    if (!this.active || this.id === POINTER) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.id) this.release();
    }
  }

  private begin(id: number, cx: number, cy: number): boolean {
    if (!this.enabled || this.active || cy < window.innerHeight * ACTIVE_TOP) return false;
    this.id = id;
    this.originX = cx;
    this.originY = cy;
    this.base.style.transform = `translate(${cx}px, ${cy}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.hidden = false;
    return true;
  }

  private drag(cx: number, cy: number): void {
    let dx = cx - this.originX;
    let dy = cy - this.originY;
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
}
