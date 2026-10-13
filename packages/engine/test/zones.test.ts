import { describe, expect, it } from 'vitest';
import { parseZoneCsv, ZoneDataError } from '../src';
import { loadParamSet, loadZones } from '../src/node/load';

const HEADER = 'bps_code,name,province,income_zone,price_zone';

describe('regency → zone CSV', () => {
  it('rejects duplicate regencies', () => {
    expect(() => parseZoneCsv(`${HEADER}\n3603,A,B,4,D\n3603,A,B,4,D`)).toThrow(/duplicate regency 3603/);
  });
  it('rejects missing regencies against the master list', () => {
    expect(() => parseZoneCsv(`${HEADER}\n3603,A,B,4,D`, ['3603', '3671'])).toThrow(/missing regency 3671/);
  });
  it('rejects blank zones and bad codes', () => {
    expect(() => parseZoneCsv(`${HEADER}\n36A3,A,B,,D`)).toThrow(ZoneDataError);
  });
  it('rejects a wrong header', () => {
    expect(() => parseZoneCsv('code,zone\n3603,4')).toThrow(/header/);
  });

  it('the shipped seed is valid and every zone has a cap in the current parameters', () => {
    const zones = loadZones();
    const flpp = loadParamSet().records;
    const incomeCaps = flpp.find((r) => r.key === 'flpp.incomeCaps')!.value as Record<string, unknown>;
    const priceCaps = flpp.find((r) => r.key === 'flpp.priceCaps.landed')!.value as Record<string, unknown>;
    for (const z of zones.values()) {
      expect(incomeCaps, `${z.bpsCode} income zone`).toHaveProperty(z.incomeZone);
      expect(priceCaps, `${z.bpsCode} price zone`).toHaveProperty(z.priceZone);
    }
  });

  it('income and price zones are independent (rule 3): Bali, NTB, NTT', () => {
    const zones = loadZones();
    expect(zones.get('5171')).toMatchObject({ incomeZone: '2', priceZone: 'D' }); // Denpasar
    expect(zones.get('5271')).toMatchObject({ incomeZone: '1', priceZone: 'D' }); // Mataram
    expect(zones.get('5371')).toMatchObject({ incomeZone: '1', priceZone: 'D' }); // Kupang
  });
});
