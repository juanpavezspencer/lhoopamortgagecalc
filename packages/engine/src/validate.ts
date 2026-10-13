import { commercialMinDpPct, type EngineConfig } from './config';
import type { InputIssue } from './errors';
import type { CalculationInput } from './types';

const isMoney = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function checkTerm(
  issues: InputIssue[],
  field: string,
  years: number | undefined,
  schemeMax: number,
  maxPayoffAge: number | null,
  age: number | undefined,
) {
  if (years === undefined) return;
  if (!Number.isInteger(years) || years < 1) issues.push({ field, code: 'INVALID' });
  else if (years > schemeMax) issues.push({ field, code: 'ABOVE_SCHEME_MAX' });
  else if (maxPayoffAge !== null && age !== undefined && years > maxPayoffAge - age) {
    issues.push({ field, code: 'EXCEEDS_PAYOFF_AGE' });
  }
}

function checkDp(issues: InputIssue[], field: string, pct: number | undefined, min: number) {
  if (pct === undefined) return;
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct >= 1) issues.push({ field, code: 'INVALID' });
  else if (pct < min) issues.push({ field, code: 'BELOW_SCHEME_MIN' });
}

/** Input validation from the spec's input table. Returns issues; empty means valid. */
export function validateInput(input: CalculationInput, cfg: EngineConfig): InputIssue[] {
  const issues: InputIssue[] = [];
  const age = input.applicantAge;

  if (typeof input.regencyCode !== 'string' || input.regencyCode === '') {
    issues.push({ field: 'regencyCode', code: 'REQUIRED' });
  }
  if (input.maritalStatus !== 'single' && input.maritalStatus !== 'married') {
    issues.push({ field: 'maritalStatus', code: 'REQUIRED' });
  }
  if (!isMoney(input.applicantIncome) || input.applicantIncome < 1_000_000 || input.applicantIncome > 200_000_000) {
    issues.push({ field: 'applicantIncome', code: 'OUT_OF_RANGE' });
  }
  if (!isMoney(input.spouseIncome)) issues.push({ field: 'spouseIncome', code: 'INVALID' });
  else if (input.maritalStatus === 'single' && input.spouseIncome !== 0) {
    issues.push({ field: 'spouseIncome', code: 'MUST_BE_ZERO_IF_SINGLE' });
  }
  if (typeof input.ownsHouse !== 'boolean') issues.push({ field: 'ownsHouse', code: 'REQUIRED' });
  if (typeof input.priorSubsidy !== 'boolean') issues.push({ field: 'priorSubsidy', code: 'REQUIRED' });
  if (!isMoney(input.existingDebtPayments)) issues.push({ field: 'existingDebtPayments', code: 'INVALID' });
  if (!isMoney(input.cashSavings)) issues.push({ field: 'cashSavings', code: 'INVALID' });
  if (input.monthlySavingCapacity !== undefined && !isMoney(input.monthlySavingCapacity)) {
    issues.push({ field: 'monthlySavingCapacity', code: 'INVALID' });
  }
  if (age !== undefined && (!Number.isInteger(age) || age < 21 || age > 64)) {
    issues.push({ field: 'applicantAge', code: 'OUT_OF_RANGE' });
  }
  if (input.targetPrice !== undefined && (!isMoney(input.targetPrice) || input.targetPrice === 0)) {
    issues.push({ field: 'targetPrice', code: 'INVALID' });
  }

  checkDp(issues, 'downPaymentPct.flpp', input.downPaymentPct?.flpp, cfg.flpp.dpMinPct);
  checkDp(issues, 'downPaymentPct.commercial', input.downPaymentPct?.commercial, commercialMinDpPct(cfg));
  checkTerm(issues, 'loanTermYears.flpp', input.loanTermYears?.flpp, cfg.flpp.termMaxYears, cfg.flpp.maxPayoffAge, age);
  checkTerm(
    issues,
    'loanTermYears.commercial',
    input.loanTermYears?.commercial,
    cfg.bank.termMaxYears,
    cfg.bank.maxPayoffAge,
    age,
  );

  const s = input.rateScenario;
  if (s?.type === 'custom') {
    if (!(s.fixedRate >= 0 && s.fixedRate < 1)) issues.push({ field: 'rateScenario.fixedRate', code: 'INVALID' });
    if (!Number.isInteger(s.fixedMonths) || s.fixedMonths < 1) {
      issues.push({ field: 'rateScenario.fixedMonths', code: 'INVALID' });
    }
  }
  return issues;
}
