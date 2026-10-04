import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { BOT_NAMES, isBotName, type BotName } from './bots/index';
import { CHARACTERS as CHARACTER_DEFS } from '../../src/data/characters';
import { WEAPONS } from '../../src/data/weapons';
import { BANDS, MAX_WEAPON_SHARE } from './bands';
import {
  evolutionCounts,
  groupStats,
  sortRuns,
  suiteHash,
  toMarkdown,
  type Check,
  type GroupStats,
  type Report,
} from './report';
import { runOne, type RunJob, type RunResult } from './run';

/** Characters simulated by default: everyone not hidden behind a secret. */
const CHARACTERS = CHARACTER_DEFS.filter((c) => !c.secret).map((c) => c.id);
const ALL_CHARACTERS = CHARACTER_DEFS.map((c) => c.id);
const MIN_SPEED = 30;
const DETERMINISM_SAMPLES = 10;

const here = dirname(fileURLToPath(import.meta.url));
const reportDir = join(here, '../../sim-reports');

const { values } = parseArgs({
  options: {
    full: { type: 'boolean', default: false },
    seeds: { type: 'string' },
    bot: { type: 'string' },
    char: { type: 'string' },
    label: { type: 'string', default: 'latest' },
    workers: { type: 'string' },
    compare: { type: 'string' },
    note: { type: 'string', multiple: true },
    gate: { type: 'string', multiple: true },
    rescore: { type: 'string' },
    fast: { type: 'boolean', default: false },
  },
});

const seedsPerGroup = values.seeds ? Number(values.seeds) : values.full ? 200 : 50;
const bots = (values.bot ? values.bot.split(',') : [...BOT_NAMES]).map((b) => {
  if (!isBotName(b)) throw new Error(`unknown bot "${b}" (have: ${BOT_NAMES.join(', ')})`);
  return b;
});
const characters = values.char ? values.char.split(',') : [...CHARACTERS];
for (const c of characters) {
  if (!ALL_CHARACTERS.includes(c)) {
    throw new Error(`unknown character "${c}" (have: ${ALL_CHARACTERS.join(', ')})`);
  }
}
const workerCount = Math.max(1, Number(values.workers ?? availableParallelism()));

const jobs: RunJob[] = [];
for (const character of characters) {
  for (const bot of bots) {
    for (let i = 1; i <= seedsPerGroup; i++) jobs.push({ seed: i, bot: bot as BotName, character });
  }
}

/**
 * Bundle the worker to plain JS once per invocation. Running the sim through
 * tsx in workers costs ~20% (module getters on every data access, loader
 * hooks); a bundle runs at full speed.
 */
async function bundleWorker(): Promise<string> {
  const outfile = join(here, '../../node_modules/.cache/lanternfall-sim/worker.mjs');
  await build({
    entryPoints: [join(here, 'worker.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    outfile,
    logLevel: 'warning',
  });
  return outfile;
}

function runInWorkers(all: RunJob[], workerFile: string): Promise<RunResult[]> {
  const chunks: RunJob[][] = Array.from({ length: Math.min(workerCount, all.length) }, () => []);
  all.forEach((job, i) => chunks[i % chunks.length]?.push(job));
  const results: RunResult[] = [];
  let done = 0;
  return Promise.all(
    chunks.map(
      (chunk) =>
        new Promise<void>((resolve, reject) => {
          const w = new Worker(workerFile, { workerData: chunk });
          w.on('message', (r: RunResult) => {
            results.push(r);
            done++;
            if (done % 25 === 0 || done === all.length) {
              process.stdout.write(`\r  ${done}/${all.length} runs`);
            }
          });
          w.on('error', reject);
          w.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`worker exit ${code}`)),
          );
        }),
    ),
  ).then(() => {
    process.stdout.write('\n');
    return results;
  });
}

/** Opt-in milestone gates (`--gate share|evolutions|bands`). */
function gateChecks(runs: RunResult[], groups: GroupStats[], gates: Set<string>): Check[] {
  const checks: Check[] = [];
  if (gates.has('share')) {
    const over = groups.flatMap((g) =>
      Object.entries(g.damageShare)
        .filter(([, f]) => f > MAX_WEAPON_SHARE)
        .map(([id, f]) => `${g.character}/${g.bot} ${id} ${(f * 100).toFixed(0)}%`),
    );
    checks.push({
      name: `No weapon over ${MAX_WEAPON_SHARE * 100}% damage share`,
      pass: over.length === 0,
      detail: over.length === 0 ? 'all groups under the cap' : over.join('; '),
    });
  }
  if (gates.has('evolutions')) {
    // Plan §14 (M4): every evolution reached by the skilled bot. Unions are
    // hidden secrets and meant to be rare, so they are reported, not gated.
    const reached = evolutionCounts(runs, 'skilled');
    const all = WEAPONS.filter((w) => w.evolvedFrom).map((w) => w.id);
    const missing = all.filter((id) => !reached[id]);
    const unions = WEAPONS.filter((w) => w.unionOf).map(
      (w) => `${w.id} ${evolutionCounts(runs)[w.id] ?? 0}`,
    );
    checks.push({
      name: 'Every evolution reached by the skilled bot',
      pass: missing.length === 0,
      detail:
        (missing.length === 0
          ? `${all.length}/${all.length} reached`
          : `missing: ${missing.join(', ')}`) + `; unions (all bots): ${unions.join(', ')}`,
    });
  }
  if (gates.has('bands')) {
    for (const g of groups) {
      const band = BANDS[g.bot as keyof typeof BANDS];
      if (!band) continue;
      const pass = g.survival >= band[0] && g.survival <= band[1];
      checks.push({
        name: `Band ${g.character}/${g.bot} ${band[0] * 100}–${band[1] * 100}%`,
        pass,
        detail: `${(g.survival * 100).toFixed(1)}% survived`,
      });
    }
  }
  return checks;
}

/** Re-apply gates to a saved report's runs (no re-simulation). */
function rescore(label: string): void {
  const path = join(reportDir, `${label}.json`);
  const old = JSON.parse(readFileSync(path, 'utf8')) as Report;
  const groups = groupStats(old.runs);
  const base = old.checks.filter((c) => !/damage share|evolution|^Band /i.test(c.name));
  const report: Report = {
    ...old,
    groups,
    notes: [...old.notes, ...(values.note ?? [])],
    checks: [...base, ...gateChecks(old.runs, groups, new Set(values.gate ?? []))],
  };
  writeFileSync(path, JSON.stringify(report, null, 1) + '\n');
  const md = toMarkdown(report);
  writeFileSync(join(reportDir, `${label}.md`), md);
  console.log(md);
  if (report.checks.some((c) => !c.pass)) process.exitCode = 1;
}

async function main(): Promise<void> {
  console.log(
    `Lanternfall sim: ${jobs.length} runs (${characters.join(',')} × ${bots.join(',')} × ${seedsPerGroup} seeds), ${workerCount} workers`,
  );
  const runs = sortRuns(await runInWorkers(jobs, await bundleWorker()));
  const checks: Check[] = [];

  const errors = runs.filter((r) => r.status === 'error');
  checks.push({
    name: 'No crashes / non-finite state',
    pass: errors.length === 0,
    detail:
      errors.length === 0
        ? 'all runs clean'
        : `${errors.length} errors, first: ${errors[0]?.error}`,
  });

  // Re-run a sample in this thread, from source via tsx rather than the
  // bundle, and compare hashes: catches nondeterminism and transform bugs.
  // --fast (searches) skips the re-check.
  const sample = values.fast ? [] : runs.filter((r) => r.seed <= DETERMINISM_SAMPLES);
  const mismatched = sample.filter((r) => runOne(r).hash !== r.hash);
  checks.push({
    name: 'Determinism (same seed ⇒ same hash)',
    pass: mismatched.length === 0,
    detail: `${sample.length - mismatched.length}/${sample.length} re-runs matched`,
  });

  const simSeconds = runs.reduce((s, r) => s + r.time, 0);
  const wallSeconds = runs.reduce((s, r) => s + r.wallMs, 0) / 1000;
  const speed = simSeconds / Math.max(wallSeconds, 1e-9);
  checks.push({
    name: `Speed ≥ ${MIN_SPEED}× real time`,
    pass: speed >= MIN_SPEED,
    detail: `${speed.toFixed(0)}×`,
  });

  if (values.compare) {
    const path = join(reportDir, `${values.compare}.json`);
    if (!existsSync(path)) throw new Error(`no report to compare: ${path}`);
    const old = JSON.parse(readFileSync(path, 'utf8')) as Report;
    const oldHash = new Map(old.runs.map((r) => [`${r.character}/${r.bot}/${r.seed}`, r.hash]));
    const shared = runs.filter((r) => oldHash.has(`${r.character}/${r.bot}/${r.seed}`));
    const diff = shared.filter((r) => oldHash.get(`${r.character}/${r.bot}/${r.seed}`) !== r.hash);
    checks.push({
      name: `Bit-identical to ${values.compare}`,
      pass: shared.length > 0 && diff.length === 0,
      detail: `${shared.length - diff.length}/${shared.length} shared runs identical`,
    });
  }

  const groups = groupStats(runs);
  checks.push(...gateChecks(runs, groups, new Set(values.gate ?? [])));

  const report: Report = {
    label: values.label,
    createdAt: new Date().toISOString(),
    seedsPerGroup,
    suiteHash: suiteHash(runs),
    speed,
    groups,
    checks,
    notes: values.note ?? [],
    runs,
  };
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, `${report.label}.json`), JSON.stringify(report, null, 1) + '\n');
  const md = toMarkdown(report);
  writeFileSync(join(reportDir, `${report.label}.md`), md);
  console.log(md);

  if (checks.some((c) => !c.pass)) process.exitCode = 1;
}

if (values.rescore) rescore(values.rescore);
else await main();
