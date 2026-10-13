import { parseParamSet, parseZoneCsv, type RegencyZone } from '@seiya/engine';
import rawParams from '@data/params/params.json';
import rawZones from '@data/zones/regency-zones.csv?raw';

/** Bundled parameter set and zone map, validated once at startup. */
export const params = parseParamSet(rawParams);
export const zones = parseZoneCsv(rawZones);

export const regencies: RegencyZone[] = [...zones.values()].sort(
  (a, b) => a.province.localeCompare(b.province) || a.name.localeCompare(b.name),
);

/** Calculation date in Indonesia (WIB). The app reads the clock; the engine never does. */
export function todayInJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}
