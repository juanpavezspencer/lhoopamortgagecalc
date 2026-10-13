import {
  calculate,
  InputError,
  type CalculationInput,
  type CalculationResult,
  type InputIssue,
  type MaritalStatus,
} from '@lhoopa/engine';
import { params, zones } from './data';

/** Raw form state. `null` = left empty. Percentages are whole numbers (10 = 10%). */
export interface FormState {
  regencyCode: string;
  maritalStatus: MaritalStatus | '';
  applicantIncome: number | null;
  spouseIncome: number | null;
  ownsHouse: boolean | null;
  priorSubsidy: boolean | null;
  existingDebtPayments: number | null;
  cashSavings: number | null;
  monthlySavingCapacity: number | null;
  applicantAge: number | null;
  targetPrice: number | null;
  commercialDpPct: number | null;
}

export const emptyForm: FormState = {
  regencyCode: '',
  maritalStatus: '',
  applicantIncome: null,
  spouseIncome: null,
  ownsHouse: null,
  priorSubsidy: null,
  existingDebtPayments: null,
  cashSavings: null,
  monthlySavingCapacity: null,
  applicantAge: null,
  targetPrice: null,
  commercialDpPct: null,
};

export type Outcome =
  | { kind: 'empty' }
  | { kind: 'issues'; issues: InputIssue[] }
  | { kind: 'ok'; result: CalculationResult }
  | { kind: 'error' };

/** Maps the form to engine input, or `null` while a required quick-mode answer is missing. */
export function toInput(f: FormState): CalculationInput | null {
  if (!f.regencyCode || !f.maritalStatus || f.applicantIncome === null || f.ownsHouse === null || f.priorSubsidy === null) {
    return null;
  }
  return {
    regencyCode: f.regencyCode,
    maritalStatus: f.maritalStatus,
    applicantIncome: f.applicantIncome,
    spouseIncome: f.maritalStatus === 'married' ? (f.spouseIncome ?? 0) : 0,
    ownsHouse: f.ownsHouse,
    priorSubsidy: f.priorSubsidy,
    existingDebtPayments: f.existingDebtPayments ?? 0,
    cashSavings: f.cashSavings ?? 0,
    ...(f.monthlySavingCapacity !== null && { monthlySavingCapacity: f.monthlySavingCapacity }),
    ...(f.applicantAge !== null && { applicantAge: f.applicantAge }),
    ...(f.targetPrice !== null && { targetPrice: f.targetPrice }),
    ...(f.commercialDpPct !== null && { downPaymentPct: { commercial: f.commercialDpPct / 100 } }),
  };
}

export function runCalculation(form: FormState, asOfDate: string): Outcome {
  const input = toInput(form);
  if (!input) return { kind: 'empty' };
  try {
    return { kind: 'ok', result: calculate(input, { asOfDate, params, zones }) };
  } catch (e) {
    if (e instanceof InputError) return { kind: 'issues', issues: e.issues };
    // Parameter problems are ours, not the user's. Nothing is logged: the input holds personal data (UU PDP).
    return { kind: 'error' };
  }
}

/** Engine field name → form field name, for showing issues next to the right input. */
export function issueField(issue: InputIssue): keyof FormState | null {
  switch (issue.field) {
    case 'downPaymentPct.commercial':
      return 'commercialDpPct';
    case 'loanTermYears.commercial':
    case 'loanTermYears.flpp':
      return 'applicantAge';
    default:
      return issue.field in emptyForm ? (issue.field as keyof FormState) : null;
  }
}
