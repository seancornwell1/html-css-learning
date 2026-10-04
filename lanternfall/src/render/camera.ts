import { VIEW_LONG, VIEW_SHORT } from '../sim/constants';

/**
 * Maps world units to canvas pixels so every screen shows the same world
 * area (GAME_DESIGN §8.4). Uses "cover" scaling so the visible area never
 * exceeds the fixed one and enemies never spawn on screen.
 */
export class Camera {
  x = 0;
  y = 0;
  scale = 1;

  fit(pixelWidth: number, pixelHeight: number): void {
    const landscape = pixelWidth >= pixelHeight;
    const viewW = landscape ? VIEW_LONG : VIEW_SHORT;
    const viewH = landscape ? VIEW_SHORT : VIEW_LONG;
    this.scale = Math.max(pixelWidth / viewW, pixelHeight / viewH);
  }
}
