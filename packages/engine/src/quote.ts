import { annuityFactor, termYears } from './finance';
import { roundPaymentUp, roundPriceDown } from './rounding';
import type { CalculationInput, TargetEvaluation, TermOption } from './types';

/** What both scheme paths need about the household. */
export interface SchemeContext {
  input: CalculationInput;
  /** Y = I3 + I4 */
  householdIncome: number;
  monthlySaving: number;
  incomeZone: string;
  priceZone: string;
}

export interface TermComparisonArgs {
  years: number[];
  schemeMaxYears: number;
  maxPayoffAge: number | null;
  age: number | undefined;
  monthlyRate: number;
  capacity: number;
  dpPct: number;
  priceCap: number;
  headlineLoan: number;
}

/** O7: max price and the headline price's payment at each comparison term (age-capped, de-duplicated). */
export function termComparison(a: TermComparisonArgs): TermOption[] {
  const seen = new Set<number>();
  const out: TermOption[] = [];
  for (const requested of a.years) {
    const { years } = termYears(a.schemeMaxYears, requested, a.maxPayoffAge, a.age);
    if (years < 1 || seen.has(years)) continue;
    seen.add(years);
    const af = annuityFactor(a.monthlyRate, years * 12);
    out.push({
      termYears: years,
      maxPrice: roundPriceDown(Math.min((a.capacity * af) / (1 - a.dpPct), a.priceCap)),
      paymentForHeadlinePrice: roundPaymentUp(a.headlineLoan / af),
    });
  }
  return out;
}

export function evaluateTarget(
  ctx: SchemeContext,
  dpPct: number,
  af: number,
  safeMaxPrice: number,
  priceCap: number,
): TargetEvaluation | null {
  const price = ctx.input.targetPrice;
  if (price === undefined) return null;
  const loan = price * (1 - dpPct);
  const payment = loan / af;
  return {
    price,
    loan: roundPriceDown(loan),
    payment: roundPaymentUp(payment),
    paymentPctIncome: payment / ctx.householdIncome,
    dsr: (payment + ctx.input.existingDebtPayments) / ctx.householdIncome,
    withinSafeMaxPrice: price <= safeMaxPrice,
    exceedsPriceCap: price > priceCap,
  };
}
