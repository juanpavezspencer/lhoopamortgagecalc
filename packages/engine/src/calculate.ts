import { computeCommercial } from './commercial';
import { loadConfig } from './config';
import { InputError } from './errors';
import { computeFlpp } from './flpp';
import { resolveParams, type ParamSet } from './params';
import type { SchemeContext } from './quote';
import type { CalculationInput, CalculationResult, IsoDate } from './types';
import { validateInput } from './validate';
import type { ZoneMap } from './zones';

export interface CalculationContext {
  /** Calculation date. Passed in; the engine never reads the clock (rule 5). */
  asOfDate: IsoDate;
  params: ParamSet;
  zones: ZoneMap;
  /** Defaults to `commercial.referenceBankId`. */
  bankId?: string;
}

/**
 * Pure: same input + same parameter set + same date = same result.
 * Throws `InputError` for invalid input and `ParamError` when the parameters in force are incomplete.
 */
export function calculate(input: CalculationInput, context: CalculationContext): CalculationResult {
  const params = resolveParams(context.params, context.asOfDate);
  const cfg = loadConfig(params, context.bankId);

  const issues = validateInput(input, cfg);
  const zone = context.zones.get(input.regencyCode);
  if (input.regencyCode && !zone) issues.push({ field: 'regencyCode', code: 'UNKNOWN_REGENCY' });
  if (issues.length > 0 || !zone) throw new InputError(issues);

  const householdIncome = input.applicantIncome + input.spouseIncome;
  const ctx: SchemeContext = {
    input,
    householdIncome,
    monthlySaving: input.monthlySavingCapacity ?? cfg.upfront.monthlySavingDefaultPct * householdIncome,
    // Two independent lookups from the BPS code (rule 3).
    incomeZone: zone.incomeZone,
    priceZone: zone.priceZone,
  };

  return {
    asOfDate: context.asOfDate,
    paramsVersion: params.version,
    incomeZone: zone.incomeZone,
    priceZone: zone.priceZone,
    householdIncome,
    flpp: computeFlpp(ctx, cfg),
    commercial: computeCommercial(ctx, cfg),
  };
}
