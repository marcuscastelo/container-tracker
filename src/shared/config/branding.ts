/**
 * Single source of truth for branding assets and identity.
 *
 * All UI references to company name, product name, and logos
 * must go through this constant — never hardcode paths or strings.
 */
export const BRANDING = {
  companyName: 'Castro Aduaneira',
  productName: 'Container Tracker',

  /** Full display title: "{companyName} — {productName}" */
  displayTitle: 'Castro Aduaneira — Container Tracker',

  /** Primary logo (horizontal / full) — for header / navbar */
  logoPrimary: '/branding/logo-primary.png',

  /** Logo mark (icon-only) — for favicon, compact spaces */
  logoMark: '/branding/logo-mark.png',

  /** Original uploaded logo (jpg) */
  logoOriginal: '/branding/logo.png',

  /** Brand primary color extracted from logo */
  colorPrimary: '#2c2f59',
} as const
