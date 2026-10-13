import type {
  BankMethod,
  CalculationResult,
  CommercialQuote,
  SchemeQuote,
  SchemeResult,
  TargetEvaluation,
  UpfrontCash,
} from '@seiya/engine';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/id';

export function Results({ result }: { result: CalculationResult }) {
  return (
    <div className="results">
      <SchemeCard kind="flpp" scheme={result.flpp} />
      <SchemeCard kind="commercial" scheme={result.commercial} />
    </div>
  );
}

function SchemeCard({ kind, scheme }: { kind: 'flpp' | 'commercial'; scheme: SchemeResult<SchemeQuote | CommercialQuote> }) {
  const { t } = useI18n();
  const q = scheme.quote;
  const commercial = q && 'bankId' in q ? q : null;

  return (
    <section className={`card scheme scheme--${kind}${q ? '' : ' scheme--ineligible'}`} aria-labelledby={`${kind}-title`}>
      <header>
        <h2 id={`${kind}-title`}>{t(`result.${kind}.title`)}</h2>
        {/* BCA is named as a reference only: no logo (branding rule). */}
        {commercial && <p className="muted">{t('result.commercial.reference', { bank: commercial.bankId.toUpperCase() })}</p>}
      </header>

      {!q ? (
        <div>
          <p className="badge badge--neutral">{t('result.notEligible')}</p>
          <ul className="reasons">
            {scheme.reasons.map((r) => (
              <li key={r}>{t(`reason.${r}`)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <Headline kind={kind} quote={q} binding={scheme.bindingConstraint} />
          {scheme.flags.map((f) => (
            <p key={f} className="notice">{t(`flag.${f}`)}</p>
          ))}
          {q.target && <Target target={q.target} kind={kind} />}
          {commercial?.bankMethod && <Promo bm={commercial.bankMethod} />}
          <TermTable quote={q} />
          <Upfront up={q.upfrontCash} />
          {scheme.warnings.length > 0 && (
            <ul className="warnings">
              {scheme.warnings.map((w) => (
                <li key={w}>{t(`warning.${w}` as MessageKey)}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Headline({ kind, quote, binding }: { kind: 'flpp' | 'commercial'; quote: SchemeQuote; binding: SchemeResult<unknown>['bindingConstraint'] }) {
  const { t, rp, pct } = useI18n();
  const rate = `${pct(quote.annualRate, 2)} ${t(kind === 'flpp' ? 'result.flppRate' : 'result.commercialRate')}`;
  return (
    <div className="headline">
      <p className="label">{t('result.safeMaxPrice')}</p>
      <p className="big">{rp(quote.safeMaxPrice)}</p>
      {binding && <p className="muted">{t(`binding.${binding}`)}</p>}
      <div className="payment">
        <span>{t('result.payment')}</span>
        <strong>{rp(quote.payment)}</strong>
        <span className="muted">{t('result.paymentPct', { pct: pct(quote.paymentPctIncome) })}</span>
      </div>
      <p className="muted small">
        {t('result.terms', { years: quote.termYears, rate, dp: pct(quote.downPaymentPct, 1) })}
      </p>
    </div>
  );
}

function Target({ target, kind }: { target: TargetEvaluation; kind: 'flpp' | 'commercial' }) {
  const { t, rp } = useI18n();
  const status =
    kind === 'flpp' && target.exceedsPriceCap
      ? { cls: 'badge--red', key: 'target.aboveCap' as const }
      : target.withinSafeMaxPrice
        ? { cls: 'badge--green', key: 'target.within' as const }
        : { cls: 'badge--amber', key: 'target.above' as const };
  return (
    <div className="target">
      <p>{t('target.title', { price: rp(target.price) })}</p>
      <span className={`badge ${status.cls}`}>{t(status.key)}</span>
      {!(kind === 'flpp' && target.exceedsPriceCap) && <p className="muted">{t('target.payment', { payment: rp(target.payment) })}</p>}
    </div>
  );
}

/** BR1: always secondary and labelled. */
function Promo({ bm }: { bm: BankMethod }) {
  const { t, rp, pct } = useI18n();
  return (
    <details className="promo">
      <summary>
        {t('promo.title')} <span className={`badge badge--${bm.riskFlag.toLowerCase()}`}>{t(`risk.${bm.riskFlag}`)}</span>
      </summary>
      <p className="muted small">{t('promo.subtitle')}</p>
      <p className="small">{t('promo.package', { rate: pct(bm.fixedRate, 2), months: bm.fixedMonths })}</p>
      <dl>
        <dt>{t('promo.maxPrice')}</dt>
        <dd>{rp(bm.maxPrice)}</dd>
        <dt>{t('promo.during')}</dt>
        <dd>{rp(bm.paymentDuringPromo)}</dd>
        <dt>{t('promo.after')}</dt>
        <dd>{rp(bm.paymentAfterPromo)}</dd>
      </dl>
      {bm.showPaymentShockBadge && <p className="badge badge--red">{t('promo.shock', { pct: pct(bm.paymentShock - 1) })}</p>}
      <p className="small">{t('promo.dsr', { pct: pct(bm.postPromoDsr) })}</p>
    </details>
  );
}

function TermTable({ quote }: { quote: SchemeQuote }) {
  const { t, rp } = useI18n();
  if (quote.termComparison.length < 2) return null;
  return (
    <details className="terms">
      <summary>{t('terms.title')}</summary>
      <table>
        <thead>
          <tr>
            <th />
            <th>{t('terms.maxPrice')}</th>
            <th>{t('terms.payment')}</th>
          </tr>
        </thead>
        <tbody>
          {quote.termComparison.map((o) => (
            <tr key={o.termYears} className={o.termYears === quote.termYears ? 'current' : ''}>
              <th scope="row">{t('terms.years', { years: o.termYears })}</th>
              <td>{rp(o.maxPrice)}</td>
              <td>{rp(o.paymentForHeadlinePrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Upfront({ up }: { up: UpfrontCash }) {
  const { t, rp } = useI18n();
  return (
    <div className="upfront">
      <h3>{t('upfront.title')}</h3>
      <p className="muted small">{t('upfront.basis', { price: rp(up.basisPrice) })}</p>
      <dl>
        {up.items.map((i) => (
          <div key={i.code} className={i.known ? '' : 'unknown'}>
            <dt>{t(`upfront.${i.code}`)}</dt>
            <dd>{i.known ? rp(i.amount) : t('upfront.unknown')}</dd>
          </div>
        ))}
        <div className="total">
          <dt>{t('upfront.total')}</dt>
          <dd>{rp(up.total)}</dd>
        </div>
      </dl>
      <p className="saving">
        {up.monthsToSave === 0
          ? t('upfront.readyNow')
          : up.monthsToSave === null
            ? t('upfront.noSaving', { amount: rp(up.shortfall) })
            : t('upfront.months', { months: up.monthsToSave })}
      </p>
    </div>
  );
}
