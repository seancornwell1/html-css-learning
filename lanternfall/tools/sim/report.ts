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
    '| Character | Bot | Runs | Survival | Median death | p25–p75 | Mean kills | Errors |',
  );
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const g of report.groups) {
    lines.push(
      `| ${g.character} | ${g.bot} | ${g.runs} | ${(g.survival * 100).toFixed(1)}% | ` +
        `${mmss(g.medianTime)} | ${mmss(g.p25Time)}–${mmss(g.p75Time)} | ` +
        `${g.meanKills.toFixed(0)} | ${g.errors} |`,
    );
  }
  lines.push('', '## Checks', '');
  for (const c of report.checks) lines.push(`- ${c.pass ? '✅' : '❌'} **${c.name}**: ${c.detail}`);
  lines.push('');
  return lines.join('\n');
}
