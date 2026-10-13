/**
 * Acceptance tests from CLAUDE.md. Tolerances: ±Rp1M on prices/loans, ±Rp10k on payments.
 * Any change to the parameters or the engine must keep these green.
 */
import { describe, expect, it } from 'vitest';
import { calculate, type CalculationInput } from '../src';
import { loadParamSet, loadZones } from '../src/node/load';

const params = loadParamSet();
const zones = loadZones();
const asOfDate = '2026-10-13';

const KAB_TANGERANG = '3603';
const M = 1_000_000;

function household(income: number): CalculationInput {
  return {
    regencyCode: KAB_TANGERANG,
    maritalStatus: 'married',
    applicantIncome: income,
    spouseIncome: 0,
    ownsHouse: false,
    priorSubsidy: false,
    existingDebtPayments: 0,
    cashSavings: 0,
  };
}

const expectPrice = (actual: number | undefined, expected: number) =>
  expect(Math.abs(actual! - expected)).toBeLessThanOrEqual(1 * M);
const expectPayment = (actual: number | undefined, expected: number) =>
  expect(Math.abs(actual! - expected)).toBeLessThanOrEqual(10_000);

describe('shared setup', () => {
  it('Kabupaten Tangerang is income zone 4, price zone D', () => {
    const r = calculate(household(10 * M), { asOfDate, params, zones });
    expect(r.incomeZone).toBe('4');
    expect(r.priceZone).toBe('D');
    expect(r.paramsVersion).toBe(params.version);
    expect(r.asOfDate).toBe(asOfDate);
  });
});

describe('Example 1: household income Rp10,000,000 (FLPP-eligible)', () => {
  const r = calculate(household(10 * M), { asOfDate, params, zones });
  const flpp = r.flpp.quote!;
  const com = r.commercial.quote!;
  const bm = com.bankMethod!;

  it('FLPP is eligible', () => {
    expect(r.flpp.eligible).toBe(true);
    expect(r.flpp.reasons).toEqual([]);
  });
  it('FLPP capacity loan at 5% over 20 years ≈ Rp455M', () => {
    expect(flpp.termYears).toBe(20);
    expectPrice(flpp.capacityMaxLoan, 455 * M);
  });
  it('FLPP safeMaxPrice = Rp185M, bound by PRICE_CAP', () => {
    expect(flpp.safeMaxPrice).toBe(185 * M);
    expect(r.flpp.bindingConstraint).toBe('PRICE_CAP');
  });
  it('FLPP payment over 20 years ≈ Rp1.21M', () => {
    expectPayment(flpp.payment, 1.21 * M);
  });
  it('FLPP payment over 40 years ≈ Rp0.88M', () => {
    const forty = flpp.termComparison.find((t) => t.termYears === 40);
    expectPayment(forty?.paymentForHeadlinePrice, 0.88 * M);
  });
  it('FLPP DP (1%) = Rp1.85M', () => {
    const dp = flpp.upfrontCash.items.find((i) => i.code === 'DOWN_PAYMENT');
    expect(dp?.amount).toBe(1.85 * M);
  });
  it('Commercial prudent: loan at 11% over 25 years ≈ Rp306M', () => {
    expect(com.annualRate).toBe(0.11);
    expect(com.termYears).toBe(25);
    expectPrice(com.safeMaxLoan, 306 * M);
  });
  it('Commercial prudent: safeMaxPrice at 10% DP ≈ Rp340M', () => {
    expect(com.downPaymentPct).toBe(0.1);
    expectPrice(com.safeMaxPrice, 340 * M);
  });
  it('Commercial bank method (bca-expo-5y, 3.81%): loan ≈ Rp580M, price ≈ Rp644M', () => {
    expect(bm.packageId).toBe('bca-expo-5y');
    expectPrice(bm.maxLoan, 580 * M);
    expectPrice(bm.maxPrice, 644 * M);
  });
  it('Commercial bank method: balance after 60 months ≈ Rp503M', () => {
    expectPrice(bm.balanceAfterPromo, 503 * M);
  });
  it('Commercial bank method: paymentAfterPromo ≈ Rp5.20M', () => {
    expectPayment(bm.paymentAfterPromo, 5.2 * M);
  });
  it('Commercial bank method: postPromoDsr ≈ 0.52 → RED', () => {
    expect(bm.postPromoDsr).toBeCloseTo(0.52, 2);
    expect(bm.riskFlag).toBe('RED');
  });
  it('headline is the safe figure, never the promo figure (BR1)', () => {
    expect(com.safeMaxPrice).toBeLessThan(bm.maxPrice);
    expect(com.listingFilter.maxPrice).toBe(com.safeMaxPrice);
    expect(com.listingFilter.stretchMaxPrice).toBe(bm.maxPrice);
  });
});

describe('Example 2: household income Rp16,000,000 (above the FLPP cap)', () => {
  const r = calculate(household(16 * M), { asOfDate, params, zones });
  const com = r.commercial.quote!;
  const bm = com.bankMethod!;

  it('FLPP is ineligible with INCOME_ABOVE_CAP', () => {
    expect(r.flpp.eligible).toBe(false);
    expect(r.flpp.reasons).toEqual(['INCOME_ABOVE_CAP']);
    expect(r.flpp.quote).toBeNull();
  });
  it('Commercial prudent: loan ≈ Rp490M, safeMaxPrice ≈ Rp544M', () => {
    expectPrice(com.safeMaxLoan, 490 * M);
    expectPrice(com.safeMaxPrice, 544 * M);
  });
  it('Commercial bank method (3.81%): loan ≈ Rp928M, price ≈ Rp1.03B', () => {
    expectPrice(bm.maxLoan, 928 * M);
    expectPrice(bm.maxPrice, 1_030 * M);
  });
  it('Commercial bank method: paymentAfterPromo ≈ Rp8.31M', () => {
    expectPayment(bm.paymentAfterPromo, 8.31 * M);
  });
  it('Commercial bank method: postPromoDsr ≈ 0.52 → RED', () => {
    expect(bm.postPromoDsr).toBeCloseTo(0.52, 2);
    expect(bm.riskFlag).toBe('RED');
  });
});
