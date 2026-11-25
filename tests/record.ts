// node tests/record.ts    Re-record golden.json after a DELIBERATE change to the rules.
import { writeFileSync } from 'node:fs';
import { play } from './helpers.ts';
import type { Run } from './helpers.ts';

const runs: Run[] = [];
for (const cols of [7, 11, 15]) for (let diff = 0; diff <= 2; diff++) for (const style of ['bot', 'wild', 'unbeatable'] as const) {
  runs.push(play({ seed: cols * 100 + diff, diff, cols, style, ticks: style === 'unbeatable' ? 12000 : 6000 }));
}
writeFileSync(new URL('./golden.json', import.meta.url), JSON.stringify(runs));
console.log(runs.map((r) => `${r.cols} ${r.diff} ${r.style}: sky ${r.level}, score ${r.score}, caught ${r.hits}`).join('\n'));
