import { describe, expect, it } from 'vitest';
import { calculate, ParamError, parseParamSet, resolveParams, type CalculationInput, type ParamRecord, type ParamSet } from '../src';
import { loadConfig } from '../src/config';
import { loadParamSet, loadZones } from '../src/node/load';

const params = loadParamSet();
const zones = loadZones();

const rec = (key: string, value: unknown, effectiveFrom: string, effectiveTo: string | null = null): ParamRecord => ({
  key,
  value,
  source: 'test',
  effectiveFrom,
  effectiveTo,
  editor: 'test',
  changeNote: '',
});

/** Copy of the real set with records replaced/added. */
function withRecords(extra: ParamRecord[], dropKeys: string[] = []): ParamSet {
  return parseParamSet({
    version: 'test',
    records: [...params.records.filter((r) => !dropKeys.includes(r.key)), ...extra],
  });
}

const tangerang: CalculationInput = {
  regencyCode: '3603',
  maritalStatus: 'married',
  applicantIncome: 10_000_000,
  spouseIncome: 0,
  ownsHouse: false,
  priorSubsidy: false,
  existingDebtPayments: 0,
  cashSavings: 0,
};

describe('parameter set validation', () => {
  it('the shipped parameter file is valid and every record has a source', () => {
    expect(params.records.length).toBeGreaterThan(0);
    for (const r of params.records) expect(r.source).not.toBe('');
  });
  it('rejects overlapping records for the same key', () => {
    expect(() =>
      parseParamSet({ version: 'x', records: [rec('a', 1, '2026-01-01', '2026-06-30'), rec('a', 2, '2026-06-30')] }),
    ).toThrow(/overlap/);
  });
  it('accepts back-to-back records', () => {
    expect(() =>
      parseParamSet({ version: 'x', records: [rec('a', 1, '2026-01-01', '2026-06-29'), rec('a', 2, '2026-06-30')] }),
    ).not.toThrow();
  });
  it('rejects bad dates and missing sources', () => {
    expect(() => parseParamSet({ version: 'x', records: [rec('a', 1, '2026-02-30')] })).toThrow(/effectiveFrom/);
    expect(() => parseParamSet({ version: 'x', records: [{ ...rec('a', 1, '2026-01-01'), source: '' }] })).toThrow(
      /source/,
    );
  });
  it('fails loudly when a required key has no value in force', () => {
    const p = resolveParams(params, '2020-01-01');
    expect(() => loadConfig(p)).toThrow(ParamError);
  });
});

describe('versioning by asOfDate (BR5, BR6)', () => {
  it('promo packages are hidden after 2026-10-31', () => {
    const before = calculate(tangerang, { asOfDate: '2026-10-31', params, zones });
    const after = calculate(tangerang, { asOfDate: '2026-11-01', params, zones });
    expect(before.commercial.quote?.bankMethod?.packageId).toBe('bca-expo-5y');
    expect(after.commercial.quote?.bankMethod).toBeNull();
    expect(after.commercial.warnings).toContain('NO_ACTIVE_PROMO_PACKAGE');
    expect(after.commercial.quote?.listingFilter.stretchMaxPrice).toBeNull();
  });

  it('0% DP is allowed until 2026-12-31, then the bank minimum applies', () => {
    const zeroDp = { ...tangerang, downPaymentPct: { commercial: 0 } };
    expect(calculate(zeroDp, { asOfDate: '2026-12-31', params, zones }).commercial.quote?.downPaymentPct).toBe(0);
    expect(() => calculate(zeroDp, { asOfDate: '2027-01-01', params, zones })).toThrow(/BELOW_SCHEME_MIN/);
  });

  it('a future-dated price-cap table switches on automatically', () => {
    const current = params.records.find((r) => r.key === 'flpp.priceCaps.landed')!;
    const set = withRecords(
      [
        { ...current, effectiveTo: '2026-12-31' },
        rec('flpp.priceCaps.landed', { A: 190e6, B: 199e6, C: 209e6, D: 212e6, E: 276e6 }, '2027-01-01'),
      ],
      ['flpp.priceCaps.landed'],
    );
    expect(calculate(tangerang, { asOfDate: '2026-12-31', params: set, zones }).flpp.quote?.safeMaxPrice).toBe(185e6);
    expect(calculate(tangerang, { asOfDate: '2027-01-01', params: set, zones }).flpp.quote?.safeMaxPrice).toBe(212e6);
  });

  it('records the parameter version used (rule 6)', () => {
    expect(calculate(tangerang, { asOfDate: '2026-10-13', params, zones }).paramsVersion).toBe('2026-10-13.1');
  });
});

describe('banks are data-driven', () => {
  it('a new bank works with parameter records only', () => {
    const overrides: Record<string, unknown> = { floatingRate: 0.12, defaultPackageId: 'p1' };
    const other = params.records
      .filter((r) => r.key.startsWith('bank.bca.') && !r.key.includes('.package.'))
      .map((r) => {
        const field = r.key.slice('bank.bca.'.length);
        return { ...r, key: `bank.other.${field}`, value: field in overrides ? overrides[field] : r.value };
      });
    const set = withRecords([...other, rec('bank.other.package.p1', { fixedRate: 0.05, fixedMonths: 36 }, '2026-10-01')]);
    const r = calculate(tangerang, { asOfDate: '2026-10-13', params: set, zones, bankId: 'other' });
    expect(r.commercial.quote?.bankId).toBe('other');
    expect(r.commercial.quote?.annualRate).toBe(0.12);
    expect(r.commercial.quote?.bankMethod?.packageId).toBe('p1');
  });
});
