/**
 * Node-only file loader. Kept out of the main entry so the engine itself stays free of I/O (rule 5).
 * Import from `@lhoopa/engine/node`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseParamSet, type ParamSet } from '../params';
import { parseZoneCsv, type ZoneMap } from '../zones';

/** Repo `data/` directory. */
export const DEFAULT_DATA_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../data');

export function loadParamSet(path = resolve(DEFAULT_DATA_DIR, 'params/params.json')): ParamSet {
  return parseParamSet(JSON.parse(readFileSync(path, 'utf8')));
}

export function loadZones(
  path = resolve(DEFAULT_DATA_DIR, 'zones/regency-zones.csv'),
  expectedCodes?: Iterable<string>,
): ZoneMap {
  return parseZoneCsv(readFileSync(path, 'utf8'), expectedCodes);
}
