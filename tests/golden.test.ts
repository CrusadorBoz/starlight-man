// The rules must not change by accident. golden.json holds a hash of the whole
// state every 500 ticks. After a deliberate change: node tests/record.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { play } from './helpers.ts';
import type { Run } from './helpers.ts';

for (const run of JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8')) as Run[]) {
  test(`${run.cols} columns, diff ${run.diff}, ${run.style}: ${run.ticks} ticks as recorded`, () => {
    const now = play(run), at = now.hashes.findIndex((h, i) => h !== run.hashes[i]);
    assert.equal(at, -1, `first differs by tick ${(at + 1) * 500}`);
    assert.deepEqual([now.score, now.level, now.hits], [run.score, run.level, run.hits]);
  });
}
