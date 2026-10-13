/**
 * Output-boundary rounding (rule 4). Never feed a rounded value back into the maths.
 * Rounding always errs against the buyer: prices and loans down, amounts they pay up.
 */

const PRICE_UNIT = 1_000_000;
const PAYMENT_UNIT = 10_000;

/**
 * Tolerance, in units, so float noise (e.g. 184_999_999.99999997) does not drop a whole unit.
 * 1e-9 of Rp1M is Rp0.001: far below anything real, so it can never round in the buyer's favour.
 */
const EPS = 1e-9;

export function roundPriceDown(value: number): number {
  return Math.floor(value / PRICE_UNIT + EPS) * PRICE_UNIT + 0; // + 0 turns -0 into 0
}

export function roundPaymentUp(value: number): number {
  return Math.ceil(value / PAYMENT_UNIT - EPS) * PAYMENT_UNIT + 0;
}

/** Upfront cash the buyer must pay. */
export const roundCashUp = roundPaymentUp;

/** Amounts in the buyer's favour (e.g. a grant). */
export function roundCashDown(value: number): number {
  return Math.floor(value / PAYMENT_UNIT + EPS) * PAYMENT_UNIT + 0;
}
