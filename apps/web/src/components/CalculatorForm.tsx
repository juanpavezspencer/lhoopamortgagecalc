import type { InputIssue } from '@lhoopa/engine';
import { useState } from 'react';
import { regencies } from '../data';
import { issueField, type FormState } from '../form';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/id';
import { Choice, Field, NumberInput } from './inputs';

interface Props {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  issues: InputIssue[];
}

export function CalculatorForm({ form, onChange, issues }: Props) {
  const { t } = useI18n();
  const [advanced, setAdvanced] = useState(form.targetPrice !== null);

  const errorFor = (field: keyof FormState) => {
    const issue = issues.find((i) => issueField(i) === field);
    return issue ? t(`issue.${issue.code}` as MessageKey) : undefined;
  };
  const yesNo = [
    { value: true, label: t('form.yes') },
    { value: false, label: t('form.no') },
  ];

  return (
    <form className="card form" onSubmit={(e) => e.preventDefault()} noValidate>
      <Field label={t('form.location')} error={errorFor('regencyCode')}>
        {(id) => (
          <select id={id} value={form.regencyCode} onChange={(e) => onChange({ regencyCode: e.target.value })}>
            <option value="">{t('form.locationPlaceholder')}</option>
            {regencies.map((r) => (
              <option key={r.bpsCode} value={r.bpsCode}>
                {r.name}, {r.province}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Choice
        label={t('form.marital')}
        value={form.maritalStatus}
        onChange={(maritalStatus) => onChange({ maritalStatus })}
        options={[
          { value: 'single' as const, label: t('form.marital.single') },
          { value: 'married' as const, label: t('form.marital.married') },
        ]}
      />

      <Field label={t('form.applicantIncome')} error={errorFor('applicantIncome')}>
        {(id) => <NumberInput id={id} prefix="Rp" value={form.applicantIncome} onChange={(applicantIncome) => onChange({ applicantIncome })} />}
      </Field>

      {form.maritalStatus === 'married' && (
        <Field label={t('form.spouseIncome')} error={errorFor('spouseIncome')}>
          {(id) => <NumberInput id={id} prefix="Rp" value={form.spouseIncome} onChange={(spouseIncome) => onChange({ spouseIncome })} />}
        </Field>
      )}

      <Choice label={t('form.ownsHouse')} value={form.ownsHouse} options={yesNo} onChange={(ownsHouse) => onChange({ ownsHouse })} />
      <Choice label={t('form.priorSubsidy')} value={form.priorSubsidy} options={yesNo} onChange={(priorSubsidy) => onChange({ priorSubsidy })} />

      <Field label={t('form.debt')} hint={t('form.debtHint')} error={errorFor('existingDebtPayments')}>
        {(id) => <NumberInput id={id} prefix="Rp" value={form.existingDebtPayments} onChange={(existingDebtPayments) => onChange({ existingDebtPayments })} />}
      </Field>

      <Field label={t('form.savings')} error={errorFor('cashSavings')}>
        {(id) => <NumberInput id={id} prefix="Rp" value={form.cashSavings} onChange={(cashSavings) => onChange({ cashSavings })} />}
      </Field>

      <button type="button" className="link-button" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
        {advanced ? t('form.advanced.hide') : t('form.advanced.show')}
      </button>

      {advanced && (
        <div className="advanced">
          <Field label={t('form.targetPrice')} error={errorFor('targetPrice')}>
            {(id) => <NumberInput id={id} prefix="Rp" value={form.targetPrice} onChange={(targetPrice) => onChange({ targetPrice })} />}
          </Field>
          <Field label={t('form.savingCapacity')} hint={t('form.savingCapacityHint')} error={errorFor('monthlySavingCapacity')}>
            {(id) => <NumberInput id={id} prefix="Rp" value={form.monthlySavingCapacity} onChange={(monthlySavingCapacity) => onChange({ monthlySavingCapacity })} />}
          </Field>
          <Field label={t('form.age')} error={errorFor('applicantAge')}>
            {(id) => <NumberInput id={id} maxDigits={2} value={form.applicantAge} onChange={(applicantAge) => onChange({ applicantAge })} />}
          </Field>
          <Field label={t('form.commercialDp')} error={errorFor('commercialDpPct')}>
            {(id) => <NumberInput id={id} maxDigits={2} value={form.commercialDpPct} onChange={(commercialDpPct) => onChange({ commercialDpPct })} />}
          </Field>
        </div>
      )}
    </form>
  );
}
