import { useEffect, useMemo, useState } from 'react';
import { CalculatorForm } from './components/CalculatorForm';
import { Logo, LogoIcon } from './components/Logo';
import { Results } from './components/Results';
import { todayInJakarta } from './data';
import { emptyForm, runCalculation, type FormState } from './form';
import { useI18n } from './i18n';

export interface AppProps {
  /** Pre-fill from a listing (I12). */
  initialTargetPrice?: number;
  initialRegencyCode?: string;
  /** Where "Talk to an advisor" goes. TODO: wire to the Seiya Capital CRM lead flow (with consent). */
  advisorUrl?: string;
  /** Widget mode: no page title. */
  embedded?: boolean;
  /** Start from these answers (e.g. a demo or an agent-assisted session). */
  initialForm?: Partial<FormState>;
}

export function App({
  initialTargetPrice,
  initialRegencyCode,
  advisorUrl = '#advisor',
  embedded = false,
  initialForm,
}: AppProps) {
  const { t, lang, setLang, date } = useI18n();
  // Nothing typed here is stored or sent anywhere (UU PDP): state lives in memory only.
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    ...initialForm,
    ...(initialRegencyCode !== undefined && { regencyCode: initialRegencyCode }),
    ...(initialTargetPrice !== undefined && { targetPrice: initialTargetPrice }),
  });
  // Read once per session; reloading picks up a new date (and so new parameters).
  const [asOfDate] = useState(todayInJakarta);
  useEffect(() => {
    if (!embedded) document.title = t('app.title');
  }, [embedded, t]);
  const outcome = useMemo(() => runCalculation(form, asOfDate), [form, asOfDate]);

  return (
    <div className={`lmc${embedded ? ' lmc--embedded' : ''}`} lang={lang}>
      <header className="top">
        {embedded ? <LogoIcon /> : <Logo />}
        <button type="button" className="link-button" onClick={() => setLang(lang === 'id' ? 'en' : 'id')}>
          {t('lang.switch')}
        </button>
      </header>
      {embedded ? <h2>{t('app.heading')}</h2> : <h1>{t('app.heading')}</h1>}
      <p className="muted">{t('app.subtitle')}</p>

      <CalculatorForm
        form={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        issues={outcome.kind === 'issues' ? outcome.issues : []}
      />

      <div aria-live="polite">
        {outcome.kind === 'empty' && <p className="card muted">{t('result.empty')}</p>}
        {outcome.kind === 'error' && <p className="card error">{t('error.generic')}</p>}
        {outcome.kind === 'ok' && (
          <>
            <Results result={outcome.result} />
            {/* BR7: never "Apply". */}
            <a className="cta" href={advisorUrl}>
              {t('cta.advisor')}
            </a>
            <footer className="disclaimer">
              <p>{t('disclaimer', { date: date(outcome.result.asOfDate) })}</p>
              <p className="muted small">{t('meta.params', { version: outcome.result.paramsVersion })}</p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
