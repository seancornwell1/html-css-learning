import type { Intent } from '../sim/intent';

const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const ACTION = new Set(['ShiftLeft', 'ShiftRight', 'Space']);

/** Keyboard → Intent. Touch input (floating joystick) arrives in M1. */
export class KeyboardInput {
  private readonly down = new Set<string>();

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      this.down.add(e.code);
      if (LEFT.has(e.code) || RIGHT.has(e.code) || UP.has(e.code) || DOWN.has(e.code)) {
        e.preventDefault();
      }
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  read(out: Intent): Intent {
    const any = (keys: Set<string>): boolean => {
      for (const k of keys) if (this.down.has(k)) return true;
      return false;
    };
    out.moveX = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
    out.moveY = (any(DOWN) ? 1 : 0) - (any(UP) ? 1 : 0);
    out.action = any(ACTION);
    return out;
  }
}
