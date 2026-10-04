import { StateHasher } from '../../src/sim/hash';
import type { RunResult } from './run';

export interface GroupStats {
  character: string;
  bot: string;
  runs: number;
  survival: number;
  medianTime: number;
  p25Time: number;
  p75Time: number;
  meanKills: number;
  meanLevel: number;
  meanLevelAt5: number;
  /** Fraction of total damage per weapon id. */
  damageShare: Record<string, number>;
  /** Mean evolutions per run and share of runs with at least one. */
  meanEvolutions: number;
  evolvedRuns: number;
  /** Median seconds to first evolution among runs that evolved (-1 if none). */
  medianFirstEvolution: number;
  errors: number;
}

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

export interface Report {
  label: string;
  createdAt: string;
  seedsPerGroup: number;
  suiteHash: string;
  /** Sim seconds per wall second, per worker. */
  speed: number;
  groups: GroupStats[];
  checks: Check[];
  /** Free-form observations passed with --note (repeatable). */
  notes: string[];
  runs: RunResult[];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i] as number;
}

export function sortRuns(runs: RunResult[]): RunResult[] {
  return [...runs].sort(
    (a, b) =>
      a.character.localeCompare(b.character) || a.bot.localeCompare(b.bot) || a.seed - b.seed,
  );
}

/** One hash over every run's state hash: equal suites ⇒ identical outcomes. */
export function suiteHash(runs: RunResult[]): string {
  const h = new StateHasher();
  for (const r of sortRuns(runs)) h.u32v(r.seed).u32v(r.hash);
  return h.digest().toString(16).padStart(8, '0');
}

function shares(list: RunResult[]): Record<string, number> {
  const totals: Record<string, number> = {};
  let all = 0;
  for (const r of list) {
    for (const [id, d] of Object.entries(r.damage)) {
      totals[id] = (totals[id] ?? 0) + d;
      all += d;
    }
  }
  for (const id of Object.keys(totals)) totals[id] = (totals[id] ?? 0) / Math.max(all, 1);
  return totals;
}

/** Runs in which each evolved/union weapon was obtained, optionally for one bot. */
export function evolutionCounts(runs: RunResult[], bot?: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of runs) {
    if (bot && r.bot !== bot) continue;
    for (const id of new Set(r.evolutions)) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

export function groupStats(runs: RunResult[]): GroupStats[] {
  const groups = new Map<string, RunResult[]>();
  for (const r of sortRuns(runs)) {
    const key = `${r.character}/${r.bot}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return [...groups.values()].map((list) => {
    const first = list[0] as RunResult;
    const times = list.map((r) => r.time).sort((a, b) => a - b);
    return {
      character: first.character,
      bot: first.bot,
      runs: list.length,
      survival: list.filter((r) => r.status === 'won').length / list.length,
      medianTime: quantile(times, 0.5),
      p25Time: quantile(times, 0.25),
      p75Time: quantile(times, 0.75),
      meanKills: list.reduce((s, r) => s + r.kills, 0) / list.length,
      meanLevel: list.reduce((s, r) => s + r.level, 0) / list.length,
      meanLevelAt5: list.reduce((s, r) => s + r.levelAt5, 0) / list.length,
      damageShare: shares(list),
      meanEvolutions: list.reduce((s, r) => s + r.evolutions.length, 0) / list.length,
      evolvedRuns: list.filter((r) => r.evolutions.length > 0).length / list.length,
      medianFirstEvolution: (() => {
        const t = list
          .map((r) => r.firstEvolution)
          .filter((x) => x >= 0)
          .sort((a, b) => a - b);
        return t.length ? quantile(t, 0.5) : -1;
      })(),
      errors: list.filter((r) => r.status === 'error').length,
    };
  });
}

const mmss = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function toMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Sim report — ${report.label}`, '');
  lines.push(`- Created: ${report.createdAt}`);
  lines.push(`- Seeds per group: ${report.seedsPerGroup}`);
  lines.push(`- Suite hash: \`${report.suiteHash}\``);
  lines.push(`- Speed: ${report.speed.toFixed(0)}× real time per worker`, '');
  lines.push('## Survival to 10:00', '');
  lines.push(
    '| Character | Bot | Runs | Survival | Median death | p25–p75 | Lv @5:00 | Final Lv | Kills | Errors |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const g of report.groups) {
    lines.push(
      `| ${g.character} | ${g.bot} | ${g.runs} | ${(g.survival * 100).toFixed(1)}% | ` +
        `${mmss(g.medianTime)} | ${mmss(g.p25Time)}–${mmss(g.p75Time)} | ` +
        `${g.meanLevelAt5.toFixed(1)} | ${g.meanLevel.toFixed(1)} | ` +
        `${g.meanKills.toFixed(0)} | ${g.errors} |`,
    );
  }
  lines.push('', '## Damage share by weapon', '');
  lines.push('| Character | Bot | Share |', '|---|---|---|');
  for (const g of report.groups) {
    const parts = Object.entries(g.damageShare)
      .sort((a, b) => b[1] - a[1])
      .map(([id, f]) => `${id} ${(f * 100).toFixed(0)}%`);
    lines.push(`| ${g.character} | ${g.bot} | ${parts.join(', ')} |`);
  }
  lines.push('', '## Evolutions', '');
  lines.push(
    '| Character | Bot | Runs with ≥1 | Mean per run | Median first |',
    '|---|---|---|---|---|',
  );
  for (const g of report.groups) {
    lines.push(
      `| ${g.character} | ${g.bot} | ${(g.evolvedRuns * 100).toFixed(0)}% | ` +
        `${g.meanEvolutions.toFixed(2)} | ${g.medianFirstEvolution >= 0 ? mmss(g.medianFirstEvolution) : '—'} |`,
    );
  }
  const reached = evolutionCounts(report.runs);
  if (Object.keys(reached).length > 0) {
    lines.push(
      '',
      'Reached (runs, all bots): ' +
        Object.entries(reached)
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => `${id} ${n}`)
          .join(', '),
    );
  }
  if (report.notes.length > 0) {
    lines.push('', '## Notes', '');
    for (const n of report.notes) lines.push(`- ${n}`);
  }
  lines.push('', '## Checks', '');
  for (const c of report.checks) lines.push(`- ${c.pass ? '✅' : '❌'} **${c.name}**: ${c.detail}`);
  lines.push('');
  return lines.join('\n');
}
