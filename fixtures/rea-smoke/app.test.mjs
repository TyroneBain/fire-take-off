import test from 'node:test';
import assert from 'node:assert/strict';
import { totalCost } from './calculation.mjs';
import { quoteSummary } from './app.mjs';

test('known fixture output is independently predictable', () => {
  assert.deepEqual(quoteSummary(3, 12.5), { quantity: 3, total: 37.5 });
});

test('zero quantity and fractional prices are accepted', () => {
  assert.equal(totalCost(0, 12.5), 0);
  assert.equal(totalCost(4, 0.25), 1);
});

test('invalid fixture inputs are rejected', () => {
  for (const value of [-1, NaN, Infinity, '3']) {
    assert.throws(() => totalCost(value, 10), RangeError);
    assert.throws(() => totalCost(1, value), RangeError);
  }
});
