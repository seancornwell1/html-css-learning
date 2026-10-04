/**
 * Length of (x, y). Use this instead of Math.hypot in hot paths: V8's
 * Math.hypot is several times slower than sqrt of the sum of squares.
 */
export function len2(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}
