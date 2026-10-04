import type { Intent } from '../sim/intent';
import type { KeyboardInput } from './keyboard';
import type { TouchStick } from './touch';

/** Merges keyboard and touch into one Intent; an active stick wins. */
export class Controller {
  constructor(
    private readonly keyboard: KeyboardInput,
    private readonly stick: TouchStick,
  ) {}

  read(out: Intent): Intent {
    this.keyboard.read(out);
    if (this.stick.active) {
      out.moveX = this.stick.x;
      out.moveY = this.stick.y;
    }
    return out;
  }
}
