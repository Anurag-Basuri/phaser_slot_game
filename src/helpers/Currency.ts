/**
 * Available currency codes for Stake Engine
 */
export type Currency =
  | 'USD' // (United States Dollar)
  | 'CAD' // (Canadian Dollar)
  | 'JPY' // (Japanese Yen)
  | 'EUR' // (Euro)
  | 'RUB' // (Russian Ruble)
  | 'CNY' // (Chinese Yuan)
  | 'PHP' // (Philippine Peso)
  | 'INR' // (Indian Rupee)
  | 'IDR' // (Indonesian Rupiah)
  | 'KRW' // (South Korean Won)
  | 'BRL' // (Brazilian Real)
  | 'MXN' // (Mexican Peso)
  | 'DKK' // (Danish Krone)
  | 'PLN' // (Polish Złoty)
  | 'VND' // (Vietnamese Đồng)
  | 'TRY' // (Turkish Lira)
  | 'CLP' // (Chilean Peso)
  | 'ARS' // (Argentine Peso)
  | 'PEN' // (Peruvian Sol)
  | 'XGC' // Stake US Gold Coin
  | 'XSC'; // Stake US Stake Cash

/**
 * Currency metadata: symbol, default decimals, symbol placement
 * 
 */
export const CurrencyMeta: Record<
  Currency | string,
  { symbol: string; decimals: number; symbolAfter?: boolean }
> = {
  USD: { symbol: '$', decimals: 2 },
  CAD: { symbol: 'CA$', decimals: 2 },
  JPY: { symbol: '¥', decimals: 0 },
  EUR: { symbol: '€', decimals: 2 },
  RUB: { symbol: '₽', decimals: 2 },
  CNY: { symbol: 'CN¥', decimals: 2 },
  PHP: { symbol: '₱', decimals: 2 },
  INR: { symbol: '₹', decimals: 2 },
  IDR: { symbol: 'Rp', decimals: 0 },
  KRW: { symbol: '₩', decimals: 0 },
  BRL: { symbol: 'R$', decimals: 2 },
  MXN: { symbol: 'MX$', decimals: 2 },
  DKK: { symbol: 'KR', decimals: 2, symbolAfter: true },
  PLN: { symbol: 'zł', decimals: 2, symbolAfter: true },
  VND: { symbol: '₫', decimals: 0, symbolAfter: true },
  TRY: { symbol: '₺', decimals: 2 },
  CLP: { symbol: 'CLP', decimals: 0, symbolAfter: true },
  ARS: { symbol: 'ARS', decimals: 2, symbolAfter: true },
  PEN: { symbol: 'S/', decimals: 2, symbolAfter: true },
  XGC: { symbol: 'GC', decimals: 2 },
  XSC: { symbol: 'SC', decimals: 2 },
};

export interface Balance {
  amount: number;
  currency: string;
}

/**
 * Formats a number with its currency symbol, respecting default decimals and symbol placement.
 * The function is intended to be used for displaying balances.
 */
export function DisplayBalance(balance: Balance): string {
  // Grabs the currency, if it doesn't exist in the list then it will display
  // the currency code behind the balance value.
  const meta = CurrencyMeta[balance.currency] ?? {
    symbol: balance.currency,
    decimals: 2,
    symbolAfter: true,
  };
  const formattedAmount = balance.amount.toFixed(meta.decimals);

  if (meta.symbolAfter) {
    return `${formattedAmount} ${meta.symbol}`;
  } else {
    return `${meta.symbol}${formattedAmount}`;
  }
}
