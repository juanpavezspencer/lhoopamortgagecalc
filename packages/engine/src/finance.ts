/** Annuity maths. Full precision; no rounding here (rule 4). Rates are monthly. */

export function annuityFactor(monthlyRate: number, months: number): number {
  if (!(months > 0)) throw new RangeError('months must be positive');
  if (monthlyRate === 0) return months;
  return (1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate;
}

export function maxLoanFor(monthlyCapacity: number, monthlyRate: number, months: number): number {
  return monthlyCapacity * annuityFactor(monthlyRate, months);
}

export function paymentFor(loan: number, monthlyRate: number, months: number): number {
  return loan / annuityFactor(monthlyRate, months);
}

/** Outstanding balance after `k` payments of `payment`. */
export function balanceAfter(loan: number, monthlyRate: number, payment: number, k: number): number {
  if (monthlyRate === 0) return loan - payment * k;
  const growth = Math.pow(1 + monthlyRate, k);
  return loan * growth - (payment * (growth - 1)) / monthlyRate;
}

export interface TermLimit {
  years: number;
  /** True when the payoff-age limit is what shortened the term. */
  limitedByAge: boolean;
}

/** BR3: years = min(scheme max, max payoff age − age, requested). */
export function termYears(
  schemeMaxYears: number,
  requestedYears: number,
  maxPayoffAge: number | null,
  age: number | undefined,
): TermLimit {
  const wanted = Math.min(schemeMaxYears, requestedYears);
  if (maxPayoffAge === null || age === undefined) return { years: wanted, limitedByAge: false };
  const ageLimit = maxPayoffAge - age;
  return ageLimit < wanted ? { years: ageLimit, limitedByAge: true } : { years: wanted, limitedByAge: false };
}
