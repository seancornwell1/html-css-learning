/**
 * Find the best skilled-bot policy (GAME_DESIGN §10: "skilled" = the best
 * policy in the bot family). Objective: mean survival to 10:00 across
 * characters (+ a small bonus for time survived). It does NOT look at the
 * difficulty bands. Usage:
 *   npx tsx tools/sim/search-skilled.ts [evals=24] [seeds=10]
 * Prints progress and writes the best params into skilled-params.ts.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rng } from '../../src/sim/rng';
import { DEFAULT_SKILLED, SKILLED_SPACE, type SkilledParams } from './bots/skilled-params';
import type { Report } from './report';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const evals = Number(process.argv[2] ?? 24);
const seeds = Number(process.argv[3] ?? 10);
const rng = new Rng(Date.now() >>> 0);

function score(params: SkilledParams): number {
  execFileSync(
    'npx',
    [
      'tsx',
      'tools/sim/cli.ts',
      '--bot',
      'skilled',
      '--seeds',
      String(seeds),
      '--label',
      'search',
      '--fast',
    ],
    { cwd: root, env: { ...process.env, SKILLED_PARAMS: JSON.stringify(params) }, stdio: 'ignore' },
  );
  const report = JSON.parse(readFileSync(join(root, 'sim-reports/search.json'), 'utf8')) as Report;
  const runs = report.runs;
  const survival = runs.filter((r) => r.status === 'won').length / runs.length;
  const time = runs.reduce((s, r) => s + r.time, 0) / runs.length / 600;
  return survival + 0.25 * time;
}

function clamp(key: keyof SkilledParams, v: number): number {
  const [lo, hi, int] = SKILLED_SPACE[key];
  const c = Math.min(hi, Math.max(lo, v));
  return int ? Math.round(c) : Math.round(c * 1000) / 1000;
}

function randomParams(): SkilledParams {
  const out = { ...DEFAULT_SKILLED };
  for (const key of Object.keys(SKILLED_SPACE) as (keyof SkilledParams)[]) {
    const [lo, hi] = SKILLED_SPACE[key];
    out[key] = clamp(key, rng.range(lo, hi));
  }
  return out;
}

function perturb(p: SkilledParams): SkilledParams {
  const out = { ...p };
  const keys = Object.keys(SKILLED_SPACE) as (keyof SkilledParams)[];
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const key = rng.pick(keys);
    const [lo, hi] = SKILLED_SPACE[key];
    out[key] = clamp(key, out[key] + rng.range(-0.25, 0.25) * (hi - lo));
  }
  return out;
}

let best = { ...DEFAULT_SKILLED };
let bestScore = score(best);
console.log(`defaults: ${bestScore.toFixed(3)}`);
for (let i = 0; i < evals; i++) {
  const candidate = i < Math.floor(evals / 3) ? randomParams() : perturb(best);
  const s = score(candidate);
  const tag = s > bestScore ? 'BEST' : '';
  console.log(`eval ${i + 1}/${evals}: ${s.toFixed(3)} ${tag} ${JSON.stringify(candidate)}`);
  if (s > bestScore) {
    best = candidate;
    bestScore = s;
  }
}
console.log(`best ${bestScore.toFixed(3)} ${JSON.stringify(best)}`);

// Write the winner back as the defaults.
const file = join(here, 'bots/skilled-params.ts');
const src = readFileSync(file, 'utf8');
const block = `export const DEFAULT_SKILLED: SkilledParams = ${JSON.stringify(best, null, 2)
  .replace(/"(\w+)":/g, '$1:')
  .replace(/\n}/, ',\n}')};`;
writeFileSync(
  file,
  src.replace(/export const DEFAULT_SKILLED: SkilledParams = \{[\s\S]*?\n\};/, block),
);
