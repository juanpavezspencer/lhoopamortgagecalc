import type { EngineConfig } from './config';
import { ParamError } from './errors';
import { annuityFactor, termYears } from './finance';
import { evaluateTarget, termComparison, type SchemeContext } from './quote';
import { roundPaymentUp, roundPriceDown } from './rounding';
import { bphtbItem, buildUpfront, notaryItem, unknownItem, type RawUpfrontItem } from './upfront';
import type { FlppIneligibleReason, ResultFlag, SchemeQuote, SchemeResult, WarningCode } from './types';

/** Routing rules. Reasons are returned in the spec's order. */
export function flppEligibility(ctx: SchemeContext, cfg: EngineConfig): FlppIneligibleReason[] {
  const { input } = ctx;
  const cap = cfg.flpp.incomeCaps[ctx.incomeZone];
  if (!cap) throw new ParamError(`No FLPP income cap for income zone "${ctx.incomeZone}"`);

  const reasons: FlppIneligibleReason[] = [];
  if (ctx.householdIncome > cap[input.maritalStatus]) reasons.push('INCOME_ABOVE_CAP');
  if (input.ownsHouse) reasons.push('OWNS_HOUSE');
  if (input.priorSubsidy) reasons.push('PRIOR_SUBSIDY');
  // Open question: "at least 21 or married". Disabled when the parameter is null; skipped when age is not given.
  const minAge = cfg.flpp.minAgeUnlessMarried;
  if (minAge !== null && input.applicantAge !== undefined && input.applicantAge < minAge && input.maritalStatus !== 'married') {
    reasons.push('AGE');
  }
  return reasons;
}

export function computeFlpp(ctx: SchemeContext, cfg: EngineConfig): SchemeResult<SchemeQuote> {
  const f = cfg.flpp;
  const { input } = ctx;
  const warnings: WarningCode[] = [];
  const flags: ResultFlag[] = [];

  const priceCap = f.priceCapsLanded[ctx.priceZone];
  if (priceCap === undefined) throw new ParamError(`No FLPP price cap for price zone "${ctx.priceZone}"`);

  const reasons = flppEligibility(ctx, cfg);
  if (reasons.length > 0) return { eligible: false, reasons, bindingConstraint: null, flags, warnings, quote: null };

  const capacity = f.dsr * ctx.householdIncome - input.existingDebtPayments;
  if (capacity <= 0) {
    return { eligible: false, reasons: ['DEBT_TOO_HIGH'], bindingConstraint: 'DEBT', flags, warnings, quote: null };
  }

  const r = f.rateLanded / 12;
  const dpPct = input.downPaymentPct?.flpp ?? f.dpDefaultPct;
  const term = termYears(f.termMaxYears, input.loanTermYears?.flpp ?? f.termDefaultYears, f.maxPayoffAge, input.applicantAge);
  const af = annuityFactor(r, term.years * 12);

  const capacityLoan = capacity * af;
  const capacityPrice = capacityLoan / (1 - dpPct);
  const maxPrice = Math.min(capacityPrice, priceCap);
  const loan = maxPrice * (1 - dpPct);
  const payment = loan / af;
  const bindingConstraint = capacityPrice > priceCap ? 'PRICE_CAP' : term.limitedByAge ? 'AGE' : 'INCOME';

  // Costs are for a concrete home: the target if FLPP can finance it, else one priced at the displayed safe max price.
  const basisPrice =
    input.targetPrice !== undefined && input.targetPrice <= priceCap ? input.targetPrice : roundPriceDown(maxPrice);
  const raw: RawUpfrontItem[] = [
    { code: 'DOWN_PAYMENT', amount: basisPrice * dpPct, known: true },
    notaryItem(basisPrice, cfg.upfront, warnings),
  ];
  if (f.bphtbExempt !== true) {
    if (f.bphtbExempt === null) warnings.push('FLPP_BPHTB_EXEMPTION_UNKNOWN');
    raw.push(bphtbItem(basisPrice, input.regencyCode, cfg.upfront, warnings));
  }
  raw.push(
    f.sbumAmount === null
      ? unknownItem('SBUM', 'SBUM_AMOUNT_UNKNOWN', warnings)
      : { code: 'SBUM', amount: f.sbumAmount, known: true },
  );

  if (input.flppListingNearby === false) flags.push('NO_FLPP_LISTING_NEARBY');

  const safeMaxPrice = roundPriceDown(maxPrice);
  return {
    eligible: true,
    reasons: [],
    bindingConstraint,
    flags,
    warnings,
    quote: {
      annualRate: f.rateLanded,
      termYears: term.years,
      downPaymentPct: dpPct,
      dsr: f.dsr,
      capacityMaxLoan: roundPriceDown(capacityLoan),
      safeMaxLoan: roundPriceDown(loan),
      safeMaxPrice,
      payment: roundPaymentUp(payment),
      paymentPctIncome: payment / ctx.householdIncome,
      termComparison: termComparison({
        years: f.termComparisonYears,
        schemeMaxYears: f.termMaxYears,
        maxPayoffAge: f.maxPayoffAge,
        age: input.applicantAge,
        monthlyRate: r,
        capacity,
        dpPct,
        priceCap,
        headlineLoan: loan,
      }),
      upfrontCash: buildUpfront(basisPrice, raw, input.cashSavings, ctx.monthlySaving),
      listingFilter: { maxPrice: safeMaxPrice, stretchMaxPrice: null, flppEligibleOnly: true },
      target: evaluateTarget(ctx, dpPct, af, maxPrice, priceCap),
    },
  };
}
