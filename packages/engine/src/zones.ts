import { ZoneDataError } from './errors';

export interface RegencyZone {
  bpsCode: string;
  name: string;
  province: string;
  /** FLPP income zone. Independent of the price zone (rule 3). */
  incomeZone: string;
  /** FLPP price zone. */
  priceZone: string;
}

export type ZoneMap = ReadonlyMap<string, RegencyZone>;

const HEADER = ['bps_code', 'name', 'province', 'income_zone', 'price_zone'];

/**
 * Parses and validates the regency → zone CSV. Rejects duplicates, blank zones and,
 * when `expectedCodes` (the master BPS list) is given, any missing regency.
 */
export function parseZoneCsv(text: string, expectedCodes?: Iterable<string>): ZoneMap {
  const problems: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines.shift()?.split(',').map((h) => h.trim());
  if (!header || header.join(',') !== HEADER.join(',')) {
    throw new ZoneDataError([`header must be "${HEADER.join(',')}"`]);
  }

  const map = new Map<string, RegencyZone>();
  lines.forEach((line, i) => {
    const row = i + 2;
    const cells = line.split(',').map((c) => c.trim());
    if (cells.length !== HEADER.length) return problems.push(`line ${row}: expected ${HEADER.length} columns`);
    const [bpsCode, name, province, incomeZone, priceZone] = cells as [string, string, string, string, string];
    if (!/^\d{4}$/.test(bpsCode)) problems.push(`line ${row}: bad BPS code "${bpsCode}"`);
    if (incomeZone === '') problems.push(`line ${row}: missing income_zone`);
    if (priceZone === '') problems.push(`line ${row}: missing price_zone`);
    if (map.has(bpsCode)) problems.push(`line ${row}: duplicate regency ${bpsCode}`);
    else map.set(bpsCode, { bpsCode, name, province, incomeZone, priceZone });
  });

  if (expectedCodes) {
    for (const code of expectedCodes) if (!map.has(code)) problems.push(`missing regency ${code}`);
  }
  if (problems.length > 0) throw new ZoneDataError(problems);
  return map;
}
