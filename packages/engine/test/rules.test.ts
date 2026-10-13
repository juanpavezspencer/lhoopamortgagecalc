import { describe, expect, it } from 'vitest';
import { calculate, InputError, type CalculationInput } from '../src';
import { loadParamSet, loadZones } from '../src/node/load';

const params = loadParamSet();
const zones = loadZones();
const asOfDate = '2026-10-13';
const M = 1_000_000;

const base: CalculationInput = {
  regencyCode: '3603',
  maritalStatus: 'married',
  applicantIncome: 10 * M,
  spouseIncome: 0,
  ownsHouse: false,
  priorSubsidy: false,
  existingDebtPayments: 0,
  cashSavings: 0,
};
const run = (patch: Partial<CalculationInput>) => calculate({ ...base, ...patch }, { asOfDate, params, zones });

describe('FLPP routing', () => {
  it('combines applicant and spouse income against the cap', () => {
    expect(run({ applicantIncome: 7 * M, spouseIncome: 7 * M }).flpp.eligible).toBe(true); // = 14M cap
    expect(run({ applicantIncome: 7 * M, spouseIncome: 7_000_001 }).flpp.reasons).toEqual(['INCOME_ABOVE_CAP']);
  });
  it('uses the single cap for single applicants', () => {
    expect(run({ maritalStatus: 'single', applicantIncome: 13 * M }).flpp.reasons).toEqual(['INCOME_ABOVE_CAP']);
  });
  it('returns every failing reason', () => {
    expect(run({ ownsHouse: true, priorSubsidy: true }).flpp.reasons).toEqual(['OWNS_HOUSE', 'PRIOR_SUBSIDY']);
  });
  it('commercial is always computed', () => {
    expect(run({ ownsHouse: true }).commercial.eligible).toBe(true);
  });
  it('flags NO_FLPP_LISTING_NEARBY but keeps both results', () => {
    const r = run({ flppListingNearby: false });
    expect(r.flpp.flags).toEqual(['NO_FLPP_LISTING_NEARBY']);
    expect(r.flpp.quote).not.toBeNull();
    expect(r.commercial.quote).not.toBeNull();
  });
  it('binds on INCOME where the price cap is not reached', () => {
    const r = run({ applicantIncome: 3 * M });
    expect(r.flpp.bindingConstraint).toBe('INCOME');
    expect(r.flpp.quote!.safeMaxPrice).toBeLessThan(185 * M);
  });
});

describe('payment capacity', () => {
  it('returns DEBT_TOO_HIGH when existing debt uses up the DSR', () => {
    const r = run({ existingDebtPayments: 3 * M });
    expect(r.flpp.reasons).toEqual(['DEBT_TOO_HIGH']);
    expect(r.flpp.bindingConstraint).toBe('DEBT');
    expect(r.commercial.reasons).toEqual(['DEBT_TOO_HIGH']);
    expect(r.commercial.quote).toBeNull();
  });
  it('existing debt lowers the max price', () => {
    expect(run({ existingDebtPayments: 1 * M }).commercial.quote!.safeMaxPrice).toBeLessThan(
      run({}).commercial.quote!.safeMaxPrice,
    );
  });
});

describe('age (BR3)', () => {
  it('shortens the commercial term to the payoff age and reports AGE', () => {
    const r = run({ applicantAge: 50 });
    expect(r.commercial.quote!.termYears).toBe(15);
    expect(r.commercial.bindingConstraint).toBe('AGE');
    expect(r.commercial.quote!.termComparison.map((t) => t.termYears)).toEqual([15]);
  });
  it('rejects a requested term past the payoff age', () => {
    expect(() => run({ applicantAge: 50, loanTermYears: { commercial: 20 } })).toThrow(/EXCEEDS_PAYOFF_AGE/);
  });
});

describe('upfront cash and saving time', () => {
  it('monthsToSave is 0 when savings already cover the cash', () => {
    expect(run({ cashSavings: 500 * M }).commercial.quote!.upfrontCash.monthsToSave).toBe(0);
  });
  it('returns null with NO_SAVING_CAPACITY when nothing can be saved', () => {
    const up = run({ monthlySavingCapacity: 0 }).commercial.quote!.upfrontCash;
    expect(up.monthsToSave).toBeNull();
    expect(up.monthsToSaveReason).toBe('NO_SAVING_CAPACITY');
  });
  it('items add up to the total, and unknown fees are flagged rather than guessed', () => {
    const r = run({});
    const up = r.commercial.quote!.upfrontCash;
    expect(up.items.reduce((s, i) => s + i.amount, 0)).toBe(up.total);
    expect(up.items.find((i) => i.code === 'NOTARY')).toMatchObject({ amount: 0, known: false });
    expect(r.commercial.warnings).toContain('NOTARY_FEE_UNKNOWN');
    expect(r.flpp.warnings).toContain('SBUM_AMOUNT_UNKNOWN');
  });
  it('uses the target price when one is given', () => {
    const r = run({ targetPrice: 300 * M });
    const q = r.commercial.quote!;
    expect(q.upfrontCash.basisPrice).toBe(300 * M);
    expect(q.upfrontCash.items.find((i) => i.code === 'DOWN_PAYMENT')!.amount).toBe(30 * M);
    expect(q.target).toMatchObject({ price: 300 * M, withinSafeMaxPrice: true });
    expect(r.flpp.quote!.target!.exceedsPriceCap).toBe(true);
  });
});

describe('rate scenarios (I15)', () => {
  it('custom fixed period drives the bank method only; the headline is unchanged', () => {
    const r = run({ rateScenario: { type: 'custom', fixedRate: 0.06, fixedMonths: 36 } });
    expect(r.commercial.quote!.bankMethod).toMatchObject({ packageId: null, fixedRate: 0.06, fixedMonths: 36 });
    expect(r.commercial.quote!.safeMaxPrice).toBe(run({}).commercial.quote!.safeMaxPrice);
  });
  it('regular_fixed is not configured yet', () => {
    const r = run({ rateScenario: { type: 'regular_fixed' } });
    expect(r.commercial.quote!.bankMethod).toBeNull();
    expect(r.commercial.warnings).toContain('REGULAR_FIXED_RATES_NOT_CONFIGURED');
  });
});

describe('input validation', () => {
  it('rejects spouse income for single applicants', () => {
    expect(() => run({ maritalStatus: 'single', spouseIncome: 1 })).toThrow(/MUST_BE_ZERO_IF_SINGLE/);
  });
  it('rejects unknown regencies', () => {
    expect(() => run({ regencyCode: '9999' })).toThrow(/UNKNOWN_REGENCY/);
  });
  it('never puts raw income values in error messages', () => {
    try {
      run({ applicantIncome: 987_654_321 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(InputError);
      expect((e as Error).message).not.toContain('987');
    }
  });
  it('is deterministic (rule 5)', () => {
    expect(run({ applicantAge: 35 })).toEqual(run({ applicantAge: 35 }));
  });
});

describe('upfront basis', () => {
  it('costs are computed on the displayed safe max price, so the breakdown is consistent', () => {
    const q = run({}).commercial.quote!;
    const dp = q.upfrontCash.items.find((i) => i.code === 'DOWN_PAYMENT')!.amount;
    expect(q.upfrontCash.basisPrice).toBe(q.safeMaxPrice);
    expect(dp).toBe(q.safeMaxPrice * q.downPaymentPct);
  });
});
