import { describe, expect, it } from 'vitest';
import { annuityFactor, balanceAfter, maxLoanFor, paymentFor } from '../src';
import { termYears } from '../src/finance';
import { roundCashDown, roundPaymentUp, roundPriceDown } from '../src/rounding';

describe('annuity', () => {
  it('AF = n when the rate is 0', () => {
    expect(annuityFactor(0, 240)).toBe(240);
  });
  it('payment and max loan are inverses', () => {
    const r = 0.11 / 12;
    const loan = maxLoanFor(3_000_000, r, 300);
    expect(paymentFor(loan, r, 300)).toBeCloseTo(3_000_000, 6);
  });
  it('balance after the full term is zero', () => {
    const r = 0.05 / 12;
    const loan = 100_000_000;
    expect(balanceAfter(loan, r, paymentFor(loan, r, 240), 240)).toBeCloseTo(0, 2);
  });
  it('balance at a zero rate is linear', () => {
    expect(balanceAfter(1200, 0, 10, 60)).toBe(600);
  });
});

describe('term (BR3)', () => {
  it('takes the smallest of scheme max, payoff age and request', () => {
    expect(termYears(25, 25, 65, undefined)).toEqual({ years: 25, limitedByAge: false });
    expect(termYears(25, 25, 65, 50)).toEqual({ years: 15, limitedByAge: true });
    expect(termYears(25, 10, 65, 50)).toEqual({ years: 10, limitedByAge: false });
    expect(termYears(40, 50, null, 50)).toEqual({ years: 40, limitedByAge: false });
  });
});

describe('rounding (rule 4)', () => {
  it('prices round down to Rp1M', () => {
    expect(roundPriceDown(340_999_999)).toBe(340_000_000);
    expect(roundPriceDown(184_999_999.99999997)).toBe(185_000_000); // float noise only
    expect(roundPriceDown(184_999_999.99)).toBe(184_000_000); // real shortfall
    expect(Object.is(roundPaymentUp(0), 0)).toBe(true);
  });
  it('payments round up to Rp10k', () => {
    expect(roundPaymentUp(1_200_001)).toBe(1_210_000);
    expect(roundPaymentUp(1_210_000)).toBe(1_210_000);
  });
  it('grants round down', () => {
    expect(roundCashDown(4_009_999)).toBe(4_000_000);
  });
});
