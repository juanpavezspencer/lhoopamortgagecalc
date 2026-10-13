import type { EngineConfig } from './config';
import { annuityFactor, balanceAfter, termYears } from './finance';
import { evaluateTarget, termComparison, type SchemeContext } from './quote';
import { roundPaymentUp, roundPriceDown } from './rounding';
import { bphtbItem, buildUpfront, notaryItem, unknownItem, type RawUpfrontItem } from './upfront';
import type { BankMethod, CommercialQuote, RiskFlag, SchemeResult, WarningCode } from './types';

interface FixedPeriod {
  packageId: string | null;
  fixedRate: number;
  fixedMonths: number;
}

/** Picks the fixed-rate period for the bank method from I15. `null` = no figure can be shown. */
function selectFixedPeriod(ctx: SchemeContext, cfg: EngineConfig, warnings: WarningCode[]): FixedPeriod | null {
  const scenario = ctx.input.rateScenario ?? { type: 'promo' as const };
  switch (scenario.type) {
    case 'custom':
      return { packageId: null, fixedRate: scenario.fixedRate, fixedMonths: scenario.fixedMonths };
    case 'regular_fixed':
      // TODO: no regular (non-promo) fixed-rate packages in the parameter data yet.
      warnings.push('REGULAR_FIXED_RATES_NOT_CONFIGURED');
      return null;
    case 'promo': {
      // Expired packages are not in force, so they are simply absent here (BR6).
      const id = scenario.packageId ?? cfg.bank.defaultPackageId;
      const pkg = cfg.bank.packages.find((p) => p.id === id);
      if (!pkg) {
        warnings.push('NO_ACTIVE_PROMO_PACKAGE');
        return null;
      }
      return { packageId: pkg.id, fixedRate: pkg.fixedRate, fixedMonths: pkg.fixedMonths };
    }
  }
}

function riskFlag(dsr: number, cfg: EngineConfig): RiskFlag {
  const { greenMax, amberMax } = cfg.commercial.riskFlag;
  return dsr <= greenMax ? 'GREEN' : dsr <= amberMax ? 'AMBER' : 'RED';
}

/** Bank method: size on the promo rate, then show what happens when it reverts to floating. */
function bankMethod(
  ctx: SchemeContext,
  cfg: EngineConfig,
  fixed: FixedPeriod,
  capacity: number,
  months: number,
  dpPct: number,
): BankMethod {
  const r1 = fixed.fixedRate / 12;
  const r2 = cfg.bank.floatingRate / 12;
  const k = Math.min(fixed.fixedMonths, months);

  const loan = capacity * annuityFactor(r1, months);
  const p1 = capacity;
  const balance = Math.max(0, balanceAfter(loan, r1, p1, k));
  const p2 = k < months ? balance / annuityFactor(r2, months - k) : 0;
  const paymentShock = p2 / p1;
  const postPromoDsr = (p2 + ctx.input.existingDebtPayments) / ctx.householdIncome;

  return {
    packageId: fixed.packageId,
    fixedRate: fixed.fixedRate,
    fixedMonths: fixed.fixedMonths,
    maxLoan: roundPriceDown(loan),
    maxPrice: roundPriceDown(loan / (1 - dpPct)),
    paymentDuringPromo: roundPaymentUp(p1),
    balanceAfterPromo: roundPriceDown(balance),
    paymentAfterPromo: roundPaymentUp(p2),
    paymentShock,
    showPaymentShockBadge: paymentShock > cfg.commercial.paymentShockBadgeAbove,
    postPromoDsr,
    riskFlag: riskFlag(postPromoDsr, cfg),
  };
}

/** Always computed. The headline is sized on the floating rate for the whole term (rule 1). */
export function computeCommercial(ctx: SchemeContext, cfg: EngineConfig): SchemeResult<CommercialQuote> {
  const bank = cfg.bank;
  const { input } = ctx;
  const warnings: WarningCode[] = [];

  const capacity = bank.dsrDefault * ctx.householdIncome - input.existingDebtPayments;
  if (capacity <= 0) {
    return { eligible: false, reasons: ['DEBT_TOO_HIGH'], bindingConstraint: 'DEBT', flags: [], warnings, quote: null };
  }

  const r = bank.floatingRate / 12;
  const dpPct = input.downPaymentPct?.commercial ?? bank.dpDefaultPct;
  const term = termYears(bank.termMaxYears, input.loanTermYears?.commercial ?? bank.termMaxYears, bank.maxPayoffAge, input.applicantAge);
  const months = term.years * 12;
  const af = annuityFactor(r, months);

  const loan = capacity * af;
  const maxPrice = loan / (1 - dpPct);
  const fixed = selectFixedPeriod(ctx, cfg, warnings);
  const bm = fixed ? bankMethod(ctx, cfg, fixed, capacity, months, dpPct) : null;

  const basisPrice = input.targetPrice ?? maxPrice;
  const basisLoan = basisPrice * (1 - dpPct);
  const raw: RawUpfrontItem[] = [
    { code: 'DOWN_PAYMENT', amount: basisPrice * dpPct, known: true },
    // Regular provision, not the promo one: the safe side.
    { code: 'PROVISION', amount: bank.provisionPct * basisLoan, known: true },
    notaryItem(basisPrice, cfg.upfront, warnings),
    bphtbItem(basisPrice, input.regencyCode, cfg.upfront, warnings),
    bank.appraisalInsurance === null
      ? unknownItem('APPRAISAL_INSURANCE', 'APPRAISAL_INSURANCE_UNKNOWN', warnings)
      : { code: 'APPRAISAL_INSURANCE', amount: bank.appraisalInsurance, known: true },
  ];

  const safeMaxPrice = roundPriceDown(maxPrice);
  return {
    eligible: true,
    reasons: [],
    bindingConstraint: term.limitedByAge ? 'AGE' : 'INCOME',
    flags: [],
    warnings,
    quote: {
      bankId: bank.id,
      annualRate: bank.floatingRate,
      termYears: term.years,
      downPaymentPct: dpPct,
      dsr: bank.dsrDefault,
      capacityMaxLoan: roundPriceDown(loan),
      safeMaxLoan: roundPriceDown(loan),
      safeMaxPrice,
      payment: roundPaymentUp(capacity),
      paymentPctIncome: capacity / ctx.householdIncome,
      termComparison: termComparison({
        years: cfg.commercial.termComparisonYears,
        schemeMaxYears: bank.termMaxYears,
        maxPayoffAge: bank.maxPayoffAge,
        age: input.applicantAge,
        monthlyRate: r,
        capacity,
        dpPct,
        priceCap: Infinity,
        headlineLoan: loan,
      }),
      upfrontCash: buildUpfront(basisPrice, raw, input.cashSavings, ctx.monthlySaving),
      listingFilter: { maxPrice: safeMaxPrice, stretchMaxPrice: bm?.maxPrice ?? null, flppEligibleOnly: false },
      target: evaluateTarget(ctx, dpPct, af, maxPrice, Infinity),
      bankMethod: bm,
    },
  };
}
