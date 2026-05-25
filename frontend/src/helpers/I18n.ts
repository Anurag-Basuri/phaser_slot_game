/**
 * Core UI Text labels that must be translated based on the `social=true` configuration flag.
 */
export const Translations = {
  // Buy Features
  "BUY FREE SPINS": { default: "BUY FREE SPINS", social: "PLAY FEATURE" },
  "SUPER FREE SPINS": { default: "SUPER FREE SPINS", social: "SUPER PLAY FEATURE" },
  "BUY": { default: "BUY", social: "PLAY NOW" },
  
  // HUD Elements
  "BALANCE": { default: "BALANCE", social: "COINS" },
  "BET": { default: "BET", social: "PLAY AMOUNT" },
  "WIN": { default: "WIN", social: "WON" },
  
  // Toggles and Labels
  "ANTE BET": { default: "ANTE BET", social: "FEATURE PLAY" },
  "LAST WIN": { default: "LAST WIN", social: "LAST WON" },
  "BET AMOUNT": { default: "BET AMOUNT", social: "PLAY AMOUNT" },
  "TOTAL BET": { default: "TOTAL BET", social: "TOTAL PLAY" },
  
  // Game Actions
  "PLACE BET": { default: "PLACE BET", social: "START ROUND" },
  
  // Overlays / Paytable
  "GAME RULES": { default: "GAME RULES", social: "PLAY RULES" },
  "ULTRA FREE SPINS": { default: "ULTRA FREE SPINS", social: "ULTRA PLAY FEATURE" }
};

type DictionaryKey = keyof typeof Translations;

/**
 * Returns the correct label depending on whether the system is booted under social casino rules.
 * @param key The Dictionary Key
 * @param isSocial True if ?social=true was passed via URL
 * @returns translated string
 */
export function T(key: string, isSocial: boolean): string {
  if (!isSocial) return key;

  // Exact Dictionary Match
  const dictionaryEntry = Translations[key as DictionaryKey];
  if (dictionaryEntry) {
    return dictionaryEntry.social;
  }
  
  // Fallback to global regex replacements for dynamically injected phrases
  let t = key;
  t = t.replace(/\bwin feature\b/gi, 'play feature');
  t = t.replace(/\bpay out\b/gi, 'win');
  t = t.replace(/\bpaid out\b/gi, 'won');
  t = t.replace(/\bstake\b/gi, 'play amount');
  t = t.replace(/\bpays out\b/gi, 'won');
  t = t.replace(/\bbetting\b/gi, 'playing');
  t = t.replace(/\btotal bet\b/gi, 'total play');
  t = t.replace(/\bbet\b/gi, 'play');
  t = t.replace(/\bbets\b/gi, 'plays');
  t = t.replace(/\bcash\b/gi, 'coins');
  t = t.replace(/\bpayer\b/gi, 'winner');
  t = t.replace(/\bpay\b/gi, 'win');
  t = t.replace(/\bpays\b/gi, 'wins');
  t = t.replace(/\bpaid\b/gi, 'won');
  t = t.replace(/\bmoney\b/gi, 'coins');
  t = t.replace(/\bbuy\b/gi, 'play');
  t = t.replace(/\bbought\b/gi, 'instantly triggered');
  t = t.replace(/\bpurchase\b/gi, 'play');
  t = t.replace(/\bat the cost of\b/gi, 'for');
  t = t.replace(/\brebet\b/gi, 'respin');
  t = t.replace(/\bcost of\b/gi, 'can be played for');
  t = t.replace(/\bcredit\b/gi, 'balance');
  t = t.replace(/\bbuy bonus\b/gi, 'get bonus');
  t = t.replace(/\bgamble\b/gi, 'play');
  t = t.replace(/\bwager\b/gi, 'play');
  t = t.replace(/\bdeposit\b/gi, 'get coins');
  t = t.replace(/\bwithdraw\b/gi, 'redeem');
  t = t.replace(/\bbonus buy\b/gi, 'bonus / feature');
  t = t.replace(/\bcurrency\b/gi, 'token');
  t = t.replace(/\bfund\b/gi, 'balance');

  return t;
}
