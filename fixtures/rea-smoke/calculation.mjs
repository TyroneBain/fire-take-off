export function totalCost(quantity, unitPrice) {
  if (!Number.isFinite(quantity) || quantity < 0 ||
      !Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new RangeError('Inputs must be finite and non-negative');
  }
  return quantity * unitPrice;
}
