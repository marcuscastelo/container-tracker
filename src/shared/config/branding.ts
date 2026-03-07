/**
 * Single source of truth for branding assets and identity in application code.
 *
 * UI references to company name, product name, and logo asset paths in TS/TSX
 * should go through this constant instead of hardcoded inline values.
 */
export const BRANDING = {
  companyName: 'Castro Aduaneira',
  productName: 'Container Tracker',

  /** Full display title: "{companyName} — {productName}" */
  displayTitle: 'Castro Aduaneira — Container Tracker',

  /** Primary logo (horizontal / full) — for header / navbar */
  logoPrimary: '/branding/logo.png',

  /** Logo mark (icon-only) — for favicon, compact spaces */
  logoMark: '/branding/logo.png',

  /** Original uploaded logo (jpg) */
  logoOriginal: '/branding/logo.png',

  /** Wallpaper background used in shipment views */
  wallpaper: '/branding/wallpaper.jpeg',

  /** Brand primary color extracted from logo */
  colorPrimary: '#2c2f59',
} as const
