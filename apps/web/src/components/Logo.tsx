import icon from '../brand/seiya-icon.svg?raw';
import logo from '../brand/seiya-logo-horizontal.svg?raw';
import logoWhite from '../brand/seiya-logo-horizontal-white.svg?raw';

// Inlined as data URIs so the widget works on any host page without fetching assets.
const dataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const sources = { icon: dataUri(icon), logo: dataUri(logo), logoWhite: dataUri(logoWhite) };

/** Horizontal logo; the white version shows on dark backgrounds (switched by theme tokens in styles.css). */
export function Logo() {
  return (
    <span className="logo">
      <img className="logo__on-light" src={sources.logo} alt="Seiya Capital" width={150} height={60} />
      <img className="logo__on-dark" src={sources.logoWhite} alt="Seiya Capital" width={150} height={60} />
    </span>
  );
}

/** App icon only, for the compact widget header. */
export function LogoIcon() {
  return <img className="logo-icon" src={sources.icon} alt="Seiya Capital" width={32} height={32} />;
}
