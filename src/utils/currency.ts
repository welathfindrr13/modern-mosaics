/**
 * Currency utilities for country-based pricing
 */

// Country code to currency mapping
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // UK & British territories
  'GB': 'GBP',
  'IM': 'GBP', // Isle of Man
  'JE': 'GBP', // Jersey
  'GG': 'GBP', // Guernsey

  // Eurozone countries
  'FR': 'EUR',
  'DE': 'EUR',
  'IT': 'EUR',
  'ES': 'EUR',
  'NL': 'EUR',
  'BE': 'EUR',
  'AT': 'EUR',
  'IE': 'EUR',
  'PT': 'EUR',
  'FI': 'EUR',
  'EE': 'EUR',
  'LV': 'EUR',
  'LT': 'EUR',
  'SK': 'EUR',
  'SI': 'EUR',
  'MT': 'EUR',
  'CY': 'EUR',
  'LU': 'EUR',
  'GR': 'EUR',

  // Other major currencies
  'US': 'USD',
  'CA': 'CAD',
  'AU': 'AUD',
  'NZ': 'NZD',
  'CH': 'CHF',
  'SE': 'SEK',
  'NO': 'NOK',
  'DK': 'DKK',
  'PL': 'PLN',
  'CZ': 'CZK',
  'HU': 'HUF',
  'JP': 'JPY',
  'KR': 'KRW',
  'SG': 'SGD',
  'HK': 'HKD',
  'MX': 'MXN',
  'BR': 'BRL',
  'IN': 'INR',
  'CN': 'CNY'
};

// VAT rates by country
export const COUNTRY_VAT_RATES: Record<string, number> = {
  // UK VAT
  'GB': 0.20,
  
  // EU VAT rates (standard rates as of 2024)
  'FR': 0.20,
  'DE': 0.19,
  'IT': 0.22,
  'ES': 0.21,
  'NL': 0.21,
  'BE': 0.21,
  'AT': 0.20,
  'IE': 0.23,
  'PT': 0.23,
  'FI': 0.24,
  'SE': 0.25,
  'DK': 0.25,
  'NO': 0.25,
  'PL': 0.23,
  'CZ': 0.21,
  'HU': 0.27,
  'GR': 0.24,
  'EE': 0.20,
  'LV': 0.21,
  'LT': 0.21,
  'SK': 0.20,
  'SI': 0.22,
  'MT': 0.18,
  'CY': 0.19,
  'LU': 0.17,

  // Non-EU countries (no VAT for display purposes)
  'US': 0.00,
  'CA': 0.00,
  'AU': 0.10, // GST
  'NZ': 0.15, // GST
  'CH': 0.077, // VAT
  'JP': 0.10,
  'KR': 0.10,
  'SG': 0.08, // GST
  'HK': 0.00,
  'MX': 0.16, // IVA
  'BR': 0.00, // Complex tax system
  'IN': 0.18, // GST
  'CN': 0.13  // VAT
};

/**
 * Get currency code for a country
 */
export function getCurrencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()] || 'USD';
}

/**
 * Get VAT rate for a country
 */
export function getVATRateForCountry(countryCode: string): number {
  return COUNTRY_VAT_RATES[countryCode.toUpperCase()] || 0;
}

/**
 * Check if a country is in the EU VAT zone
 */
export function isEUCountry(countryCode: string): boolean {
  const euCountries = [
    'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 
    'SE', 'DK', 'PL', 'CZ', 'HU', 'GR', 'EE', 'LV', 'LT', 'SK', 
    'SI', 'MT', 'CY', 'LU', 'HR', 'BG', 'RO'
  ];
  return euCountries.includes(countryCode.toUpperCase());
}

/**
 * Check if VAT should be displayed for a country
 */
export function shouldDisplayVAT(countryCode: string): boolean {
  return isEUCountry(countryCode) || countryCode.toUpperCase() === 'GB';
}

/**
 * Format currency display name
 */
export function getCurrencyDisplayName(currency: string): string {
  const names: Record<string, string> = {
    'GBP': 'British Pound',
    'EUR': 'Euro',
    'USD': 'US Dollar',
    'CAD': 'Canadian Dollar',
    'AUD': 'Australian Dollar',
    'NZD': 'New Zealand Dollar',
    'CHF': 'Swiss Franc',
    'SEK': 'Swedish Krona',
    'NOK': 'Norwegian Krone',
    'DKK': 'Danish Krone',
    'PLN': 'Polish Złoty',
    'CZK': 'Czech Koruna',
    'HUF': 'Hungarian Forint',
    'JPY': 'Japanese Yen',
    'KRW': 'Korean Won',
    'SGD': 'Singapore Dollar',
    'HKD': 'Hong Kong Dollar',
    'MXN': 'Mexican Peso',
    'BRL': 'Brazilian Real',
    'INR': 'Indian Rupee',
    'CNY': 'Chinese Yuan'
  };
  
  return names[currency] || currency;
}

/**
 * Get the appropriate locale for currency formatting
 */
export function getLocaleForCurrency(currency: string): string {
  const locales: Record<string, string> = {
    'GBP': 'en-GB',
    'EUR': 'en-EU',
    'USD': 'en-US',
    'CAD': 'en-CA',
    'AUD': 'en-AU',
    'NZD': 'en-NZ',
    'CHF': 'de-CH',
    'SEK': 'sv-SE',
    'NOK': 'nb-NO',
    'DKK': 'da-DK',
    'PLN': 'pl-PL',
    'CZK': 'cs-CZ',
    'HUF': 'hu-HU',
    'JPY': 'ja-JP',
    'KRW': 'ko-KR',
    'SGD': 'en-SG',
    'HKD': 'en-HK',
    'MXN': 'es-MX',
    'BRL': 'pt-BR',
    'INR': 'en-IN',
    'CNY': 'zh-CN'
  };
  
  return locales[currency] || 'en-US';
}
