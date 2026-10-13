/**
 * Embeddable widget for Lhoopa listing pages.
 *
 *   <div data-lhoopa-calculator data-regency="3603" data-target-price="350000000" data-lang="id"
 *        data-advisor-url="https://..."></div>
 *   <script src="lhoopa-calculator.js"></script>
 *
 * Renders into a shadow root so host-page CSS and the widget's CSS cannot affect each other.
 * Also exposes `window.LhoopaCalculator.mount(element, options)`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { I18nProvider, type Lang } from './i18n';
import styles from './styles.css?inline';

export interface WidgetOptions {
  regencyCode?: string;
  targetPrice?: number;
  lang?: Lang;
  advisorUrl?: string;
}

export function mount(host: HTMLElement, options: WidgetOptions = {}) {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${styles}</style><div></div>`;
  createRoot(shadow.lastElementChild as HTMLElement).render(
    <StrictMode>
      <I18nProvider initialLang={options.lang ?? 'id'}>
        <App
          embedded
          initialRegencyCode={options.regencyCode}
          initialTargetPrice={options.targetPrice}
          advisorUrl={options.advisorUrl}
        />
      </I18nProvider>
    </StrictMode>,
  );
}

function optionsFrom(el: HTMLElement): WidgetOptions {
  const { regency, targetPrice, lang, advisorUrl } = el.dataset;
  const price = Number(targetPrice);
  return {
    ...(regency && { regencyCode: regency }),
    ...(Number.isInteger(price) && price > 0 && { targetPrice: price }),
    ...((lang === 'id' || lang === 'en') && { lang }),
    ...(advisorUrl && { advisorUrl }),
  };
}

function mountAll() {
  document.querySelectorAll<HTMLElement>('[data-lhoopa-calculator]').forEach((el) => mount(el, optionsFrom(el)));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
else mountAll();
