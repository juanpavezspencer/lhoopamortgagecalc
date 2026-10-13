import { ParamError } from './errors';
import type { ResolvedParams } from './params';

/** Typed views over the resolved parameters. Every business number the engine uses comes from here. */

export interface IncomeCap {
  single: number;
  married: number;
}

export interface FlppConfig {
  rateLanded: number;
  termMaxYears: number;
  termDefaultYears: number;
  termComparisonYears: number[];
  dpMinPct: number;
  dpDefaultPct: number;
  sbumAmount: number | null;
  dsr: number;
  maxPayoffAge: number | null;
  minAgeUnlessMarried: number | null;
  bphtbExempt: boolean | null;
  incomeCaps: Record<string, IncomeCap>;
  priceCapsLanded: Record<string, number>;
}

export interface PromoPackage {
  id: string;
  fixedRate: number;
  fixedMonths: number;
}

export interface BankConfig {
  id: string;
  termMaxYears: number;
  maxPayoffAge: number;
  floatingRate: number;
  dpDefaultPct: number;
  dpMinPct: number;
  dsrDefault: number;
  provisionPct: number;
  appraisalInsurance: number | null;
  defaultPackageId: string | null;
  /** Only packages in force on the calculation date (BR6). */
  packages: PromoPackage[];
}

export interface CommercialConfig {
  termComparisonYears: number[];
  riskFlag: { greenMax: number; amberMax: number };
  paymentShockBadgeAbove: number;
  /** BI LTV relaxation; `null` once it has expired. */
  biMaxLtv: number | null;
}

export interface UpfrontConfig {
  notaryPct: number | null;
  bphtbRate: number;
  npoptkpByRegency: Record<string, number>;
  monthlySavingDefaultPct: number;
}

export interface EngineConfig {
  flpp: FlppConfig;
  bank: BankConfig;
  commercial: CommercialConfig;
  upfront: UpfrontConfig;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function numberRecord(p: ResolvedParams, key: string): Record<string, number> {
  const v = p.required(key);
  if (!isRecord(v) || !Object.values(v).every((x) => typeof x === 'number' && Number.isFinite(x))) {
    throw new ParamError(`"${key}" must be an object of numbers`);
  }
  return v as Record<string, number>;
}

function yearsList(p: ResolvedParams, key: string): number[] {
  const v = p.required(key);
  if (!Array.isArray(v) || !v.every((x) => Number.isInteger(x) && x > 0)) {
    throw new ParamError(`"${key}" must be a list of positive integers`);
  }
  return v as number[];
}

function booleanOrNull(p: ResolvedParams, key: string): boolean | null {
  const v = p.required(key);
  if (v !== null && typeof v !== 'boolean') throw new ParamError(`"${key}" must be a boolean or null`);
  return v;
}

function loadFlpp(p: ResolvedParams): FlppConfig {
  const caps = p.required('flpp.incomeCaps');
  if (
    !isRecord(caps) ||
    !Object.values(caps).every((c) => isRecord(c) && typeof c.single === 'number' && typeof c.married === 'number')
  ) {
    throw new ParamError('"flpp.incomeCaps" must map zone → { single, married }');
  }
  return {
    rateLanded: p.number('flpp.rate.landed'),
    termMaxYears: p.number('flpp.term.maxYears'),
    termDefaultYears: p.number('flpp.term.defaultYears'),
    termComparisonYears: yearsList(p, 'flpp.term.comparisonYears'),
    dpMinPct: p.number('flpp.dp.minPct'),
    dpDefaultPct: p.number('flpp.dp.defaultPct'),
    sbumAmount: p.numberOrNull('flpp.sbum.amount'),
    dsr: p.number('flpp.dsr'),
    maxPayoffAge: p.numberOrNull('flpp.maxPayoffAge'),
    minAgeUnlessMarried: p.numberOrNull('flpp.eligibility.minAgeUnlessMarried'),
    bphtbExempt: booleanOrNull(p, 'flpp.bphtbExempt'),
    incomeCaps: caps as Record<string, IncomeCap>,
    priceCapsLanded: numberRecord(p, 'flpp.priceCaps.landed'),
  };
}

export function loadBank(p: ResolvedParams, bankId: string): BankConfig {
  const k = (s: string) => `bank.${bankId}.${s}`;
  const packagePrefix = k('package.');
  const packages = p.keysWithPrefix(packagePrefix).map((key): PromoPackage => {
    const v = p.required(key);
    if (!isRecord(v) || typeof v.fixedRate !== 'number' || !Number.isInteger(v.fixedMonths)) {
      throw new ParamError(`"${key}" must be { fixedRate, fixedMonths }`);
    }
    return { id: key.slice(packagePrefix.length), fixedRate: v.fixedRate, fixedMonths: v.fixedMonths as number };
  });
  const defaultPackageId = p.optional(k('defaultPackageId'));
  return {
    id: bankId,
    termMaxYears: p.number(k('term.maxYears')),
    maxPayoffAge: p.number(k('maxPayoffAge')),
    floatingRate: p.number(k('floatingRate')),
    dpDefaultPct: p.number(k('dp.defaultPct')),
    dpMinPct: p.number(k('dp.minPct')),
    dsrDefault: p.number(k('dsr.default')),
    provisionPct: p.number(k('provisionPct')),
    appraisalInsurance: p.numberOrNull(k('appraisalInsurance')),
    defaultPackageId: typeof defaultPackageId === 'string' ? defaultPackageId : null,
    packages,
  };
}

export function loadConfig(p: ResolvedParams, bankId?: string): EngineConfig {
  const riskFlag = numberRecord(p, 'commercial.riskFlag');
  if (riskFlag.greenMax === undefined || riskFlag.amberMax === undefined) {
    throw new ParamError('"commercial.riskFlag" needs greenMax and amberMax');
  }
  const biMaxLtv = p.optional('bi.ltv.maxLtv');
  return {
    flpp: loadFlpp(p),
    bank: loadBank(p, bankId ?? p.string('commercial.referenceBankId')),
    commercial: {
      termComparisonYears: yearsList(p, 'commercial.term.comparisonYears'),
      riskFlag: { greenMax: riskFlag.greenMax, amberMax: riskFlag.amberMax },
      paymentShockBadgeAbove: p.number('commercial.paymentShockBadgeAbove'),
      biMaxLtv: typeof biMaxLtv === 'number' ? biMaxLtv : null,
    },
    upfront: {
      notaryPct: p.numberOrNull('upfront.notaryPct'),
      bphtbRate: p.number('upfront.bphtb.rate'),
      npoptkpByRegency: numberRecord(p, 'upfront.bphtb.npoptkp'),
      monthlySavingDefaultPct: p.number('upfront.monthlySavingDefaultPct'),
    },
  };
}

/** Lowest DP the commercial path accepts: the BI LTV relaxation while in force, else the bank minimum. */
export function commercialMinDpPct(cfg: EngineConfig): number {
  return cfg.commercial.biMaxLtv === null ? cfg.bank.dpMinPct : Math.max(0, 1 - cfg.commercial.biMaxLtv);
}
