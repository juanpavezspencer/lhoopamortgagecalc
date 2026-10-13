import type { UpfrontConfig } from './config';
import { roundCashDown, roundCashUp, roundPriceDown } from './rounding';
import type { UpfrontCash, UpfrontItem, UpfrontItemCode, WarningCode } from './types';

/** Full-precision cost line. `amount` is what the buyer pays, except SBUM which is the grant amount. */
export interface RawUpfrontItem {
  code: UpfrontItemCode;
  amount: number;
  known: boolean;
}

/** An item whose value is an open question: counted as 0, flagged unknown, warned about. */
export function unknownItem(code: UpfrontItemCode, warning: WarningCode, warnings: WarningCode[]): RawUpfrontItem {
  warnings.push(warning);
  return { code, amount: 0, known: false };
}

export function notaryItem(price: number, cfg: UpfrontConfig, warnings: WarningCode[]): RawUpfrontItem {
  if (cfg.notaryPct === null) return unknownItem('NOTARY', 'NOTARY_FEE_UNKNOWN', warnings);
  return { code: 'NOTARY', amount: cfg.notaryPct * price, known: true };
}

/** BPHTB = rate × max(0, price − NPOPTKP). A missing NPOPTKP is taken as 0, which overstates the tax (safe side). */
export function bphtbItem(
  price: number,
  regencyCode: string,
  cfg: UpfrontConfig,
  warnings: WarningCode[],
): RawUpfrontItem {
  let npoptkp = cfg.npoptkpByRegency[regencyCode];
  if (npoptkp === undefined) {
    warnings.push('NPOPTKP_UNKNOWN_ASSUMED_ZERO');
    npoptkp = 0;
  }
  return { code: 'BPHTB', amount: cfg.bphtbRate * Math.max(0, price - npoptkp), known: true };
}

/**
 * Rounds each line (costs up, the SBUM grant down), totals the rounded lines so the
 * breakdown adds up on screen, then works out the shortfall and months to save.
 */
export function buildUpfront(
  basisPrice: number,
  raw: RawUpfrontItem[],
  cashSavings: number,
  monthlySaving: number,
): UpfrontCash {
  const items: UpfrontItem[] = raw.map((r) => ({
    code: r.code,
    amount: r.code === 'SBUM' ? 0 - roundCashDown(r.amount) : roundCashUp(r.amount),
    known: r.known,
  }));
  const total = Math.max(0, items.reduce((sum, i) => sum + i.amount, 0));
  const shortfall = Math.max(0, total - cashSavings);

  let monthsToSave: number | null = 0;
  let monthsToSaveReason: UpfrontCash['monthsToSaveReason'] = null;
  if (shortfall > 0) {
    if (monthlySaving > 0) {
      monthsToSave = Math.ceil(shortfall / monthlySaving);
    } else {
      monthsToSave = null;
      monthsToSaveReason = 'NO_SAVING_CAPACITY';
    }
  }
  return { basisPrice: roundPriceDown(basisPrice), items, total, shortfall, monthsToSave, monthsToSaveReason };
}
