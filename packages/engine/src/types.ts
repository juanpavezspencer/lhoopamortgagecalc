/** Calendar date as `YYYY-MM-DD`. */
export type IsoDate = string;

export type MaritalStatus = 'single' | 'married';
export type EmploymentType = 'salaried' | 'self_employed' | 'informal';

/** I15. Only affects the secondary "with promo rate" figure; the headline is always the floating rate. */
export type RateScenario =
  | { type: 'promo'; packageId?: string }
  | { type: 'regular_fixed' }
  | { type: 'custom'; fixedRate: number; fixedMonths: number };

/** Money fields are integer rupiah. Field comments give the spec input ID. */
export interface CalculationInput {
  /** I1: BPS regency/city code. */
  regencyCode: string;
  /** I2 */
  maritalStatus: MaritalStatus;
  /** I3: applicant gross monthly income. */
  applicantIncome: number;
  /** I4: spouse gross monthly income; must be 0 if single. */
  spouseIncome: number;
  /** I5 */
  ownsHouse: boolean;
  /** I6 */
  priorSubsidy: boolean;
  /** I7: existing monthly debt payments. */
  existingDebtPayments: number;
  /** I8 */
  cashSavings: number;
  /** I9: defaults to `upfront.monthlySavingDefaultPct` × household income. */
  monthlySavingCapacity?: number;
  /** I10 */
  applicantAge?: number;
  /** I11: document hints only; not used in the maths. */
  employmentType?: EmploymentType;
  /** I12: optional, usually pre-filled from a listing. */
  targetPrice?: number;
  /** I13: down payment as a fraction (0.1 = 10%), per scheme. */
  downPaymentPct?: { flpp?: number; commercial?: number };
  /** I14: loan term in years, per scheme. */
  loanTermYears?: { flpp?: number; commercial?: number };
  /** I15: commercial only. */
  rateScenario?: RateScenario;
  /**
   * Supplied by the caller from listing data (the engine does no I/O).
   * `false` adds `NO_FLPP_LISTING_NEARBY` to an eligible FLPP result.
   */
  flppListingNearby?: boolean;
}

export type FlppIneligibleReason = 'INCOME_ABOVE_CAP' | 'OWNS_HOUSE' | 'PRIOR_SUBSIDY' | 'AGE';
export type ReasonCode = FlppIneligibleReason | 'DEBT_TOO_HIGH';
export type BindingConstraint = 'INCOME' | 'PRICE_CAP' | 'AGE' | 'DEBT';
export type RiskFlag = 'GREEN' | 'AMBER' | 'RED';
export type ResultFlag = 'NO_FLPP_LISTING_NEARBY';

/** Places where the engine had to work around an open question or missing data. */
export type WarningCode =
  | 'SBUM_AMOUNT_UNKNOWN'
  | 'NOTARY_FEE_UNKNOWN'
  | 'APPRAISAL_INSURANCE_UNKNOWN'
  | 'NPOPTKP_UNKNOWN_ASSUMED_ZERO'
  | 'FLPP_BPHTB_EXEMPTION_UNKNOWN'
  | 'NO_ACTIVE_PROMO_PACKAGE'
  | 'REGULAR_FIXED_RATES_NOT_CONFIGURED';

export type UpfrontItemCode =
  | 'DOWN_PAYMENT'
  | 'PROVISION'
  | 'NOTARY'
  | 'BPHTB'
  | 'APPRAISAL_INSURANCE'
  | 'SBUM';

export interface UpfrontItem {
  code: UpfrontItemCode;
  /** Rupiah, rounded up (SBUM, a deduction, is rounded down and negative). */
  amount: number;
  /** False when the amount is unknown (open question) and was counted as 0. */
  known: boolean;
}

export interface UpfrontCash {
  /** Price the costs are based on: the target price if given, else the safe max price. */
  basisPrice: number;
  items: UpfrontItem[];
  total: number;
  shortfall: number;
  /** 0 = ready now; null when there is a shortfall and no saving capacity. */
  monthsToSave: number | null;
  monthsToSaveReason: 'NO_SAVING_CAPACITY' | null;
}

export interface TermOption {
  termYears: number;
  maxPrice: number;
  /** Monthly payment for the headline price over this term. */
  paymentForHeadlinePrice: number;
}

export interface TargetEvaluation {
  price: number;
  loan: number;
  payment: number;
  paymentPctIncome: number;
  /** (payment + existing debt) ÷ income. */
  dsr: number;
  withinSafeMaxPrice: boolean;
  /** FLPP only: the target is above the regional price cap, so FLPP cannot finance it. */
  exceedsPriceCap: boolean;
}

export interface ListingFilter {
  /** BR2: listings are filtered on the safe max price. */
  maxPrice: number;
  /** BR2: optional "stretch" ceiling (bank-method price), commercial only. */
  stretchMaxPrice: number | null;
  /** BR4 */
  flppEligibleOnly: boolean;
}

export interface SchemeQuote {
  annualRate: number;
  termYears: number;
  downPaymentPct: number;
  dsr: number;
  /** Loan the payment capacity supports at the headline rate, before any price cap. */
  capacityMaxLoan: number;
  /** Loan at the safe max price. */
  safeMaxLoan: number;
  /** O2: the headline figure. */
  safeMaxPrice: number;
  /** O5 */
  payment: number;
  paymentPctIncome: number;
  /** O7 */
  termComparison: TermOption[];
  /** O8, O9 */
  upfrontCash: UpfrontCash;
  /** O10 */
  listingFilter: ListingFilter;
  target: TargetEvaluation | null;
}

/** Secondary figure, labelled "with promo rate" in the UI (never the headline). */
export interface BankMethod {
  packageId: string | null;
  fixedRate: number;
  fixedMonths: number;
  maxLoan: number;
  /** O3 */
  maxPrice: number;
  paymentDuringPromo: number;
  balanceAfterPromo: number;
  paymentAfterPromo: number;
  /** O6 */
  paymentShock: number;
  showPaymentShockBadge: boolean;
  postPromoDsr: number;
  riskFlag: RiskFlag;
}

export interface CommercialQuote extends SchemeQuote {
  bankId: string;
  bankMethod: BankMethod | null;
}

export interface SchemeResult<Q> {
  /** O1 */
  eligible: boolean;
  reasons: ReasonCode[];
  /** O4: null when ineligible for a non-debt reason. */
  bindingConstraint: BindingConstraint | null;
  flags: ResultFlag[];
  warnings: WarningCode[];
  quote: Q | null;
}

export interface CalculationResult {
  /** O11 */
  asOfDate: IsoDate;
  paramsVersion: string;
  incomeZone: string;
  priceZone: string;
  householdIncome: number;
  flpp: SchemeResult<SchemeQuote>;
  commercial: SchemeResult<CommercialQuote>;
}
