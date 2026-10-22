import { totalCost } from './calculation.mjs';

export function quoteSummary(quantity, unitPrice) {
  return { quantity, total: totalCost(quantity, unitPrice) };
}

console.log(JSON.stringify(quoteSummary(3, 12.5)));
