import { ParamError } from './errors';
import type { IsoDate } from './types';

export interface ParamRecord {
  key: string;
  value: unknown;
  source: string;
  effectiveFrom: IsoDate;
  /** Inclusive. `null` = open-ended. */
  effectiveTo: IsoDate | null;
  editor: string;
  changeNote: string;
}

export interface ParamSet {
  version: string;
  description?: string;
  records: ParamRecord[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function inForce(record: ParamRecord, asOfDate: IsoDate): boolean {
  // ISO dates compare correctly as strings.
  return record.effectiveFrom <= asOfDate && (record.effectiveTo === null || asOfDate <= record.effectiveTo);
}

function overlaps(a: ParamRecord, b: ParamRecord): boolean {
  const aEnd = a.effectiveTo ?? '9999-12-31';
  const bEnd = b.effectiveTo ?? '9999-12-31';
  return a.effectiveFrom <= bEnd && b.effectiveFrom <= aEnd;
}

/** Checks shape, dates and that no key has two records in force on the same day. */
export function parseParamSet(raw: unknown): ParamSet {
  if (typeof raw !== 'object' || raw === null) throw new ParamError('Parameter set must be an object');
  const { version, description, records } = raw as Record<string, unknown>;
  if (typeof version !== 'string' || version === '') throw new ParamError('Parameter set needs a version');
  if (!Array.isArray(records)) throw new ParamError('Parameter set needs a records array');

  const problems: string[] = [];
  const byKey = new Map<string, ParamRecord[]>();
  records.forEach((rec: unknown, i) => {
    const r = rec as Partial<ParamRecord> | null;
    const where = `records[${i}]${r && typeof r.key === 'string' ? ` (${r.key})` : ''}`;
    if (!r || typeof r !== 'object') return problems.push(`${where}: not an object`);
    if (typeof r.key !== 'string' || r.key === '') problems.push(`${where}: missing key`);
    if (!('value' in r)) problems.push(`${where}: missing value`);
    if (typeof r.source !== 'string' || r.source === '') problems.push(`${where}: missing source`);
    if (!isIsoDate(r.effectiveFrom)) problems.push(`${where}: bad effectiveFrom`);
    if (r.effectiveTo !== null && !isIsoDate(r.effectiveTo)) problems.push(`${where}: bad effectiveTo`);
    if (isIsoDate(r.effectiveFrom) && isIsoDate(r.effectiveTo) && r.effectiveTo < r.effectiveFrom) {
      problems.push(`${where}: effectiveTo before effectiveFrom`);
    }
    if (typeof r.editor !== 'string' || r.editor === '') problems.push(`${where}: missing editor`);
    if (typeof r.changeNote !== 'string') problems.push(`${where}: missing changeNote`);
    if (typeof r.key === 'string') {
      const list = byKey.get(r.key) ?? [];
      list.push(r as ParamRecord);
      byKey.set(r.key, list);
    }
  });
  if (problems.length === 0) {
    for (const [key, list] of byKey) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (overlaps(list[i]!, list[j]!)) problems.push(`${key}: records overlap in time`);
        }
      }
    }
  }
  if (problems.length > 0) throw new ParamError(`Invalid parameter set:\n- ${problems.join('\n- ')}`);

  return { version, ...(typeof description === 'string' ? { description } : {}), records: records as ParamRecord[] };
}

/** The parameter values in force on one date. */
export class ResolvedParams {
  private readonly values = new Map<string, unknown>();

  constructor(
    readonly version: string,
    readonly asOfDate: IsoDate,
    records: ParamRecord[],
  ) {
    for (const r of records) if (inForce(r, asOfDate)) this.values.set(r.key, r.value);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  keysWithPrefix(prefix: string): string[] {
    return [...this.values.keys()].filter((k) => k.startsWith(prefix)).sort();
  }

  /** Raw value, or `undefined` if no record is in force. */
  optional(key: string): unknown {
    return this.values.get(key);
  }

  required(key: string): unknown {
    if (!this.values.has(key)) {
      throw new ParamError(`No value in force for "${key}" on ${this.asOfDate} (params ${this.version})`);
    }
    return this.values.get(key);
  }

  number(key: string): number {
    const v = this.required(key);
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new ParamError(`"${key}" must be a number`);
    return v;
  }

  /** The key must be in force, but its value may be `null` (an open question). */
  numberOrNull(key: string): number | null {
    const v = this.required(key);
    if (v === null) return null;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new ParamError(`"${key}" must be a number or null`);
    return v;
  }

  string(key: string): string {
    const v = this.required(key);
    if (typeof v !== 'string') throw new ParamError(`"${key}" must be a string`);
    return v;
  }
}

export function resolveParams(set: ParamSet, asOfDate: IsoDate): ResolvedParams {
  if (!isIsoDate(asOfDate)) throw new ParamError(`asOfDate must be YYYY-MM-DD, got "${asOfDate}"`);
  return new ResolvedParams(set.version, asOfDate, set.records);
}
