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
  "GAME RULES": { default: "GAME RULES", social: "PLAY RULES" }
};

type DictionaryKey = keyof typeof Translations;

/**
 * Returns the correct label depending on whether the system is booted under social casino rules.
 * @param key The Dictionary Key
 * @param isSocial True if ?social=true was passed via URL
 * @returns translated string
 */
export function T(key: string, isSocial: boolean): string {
  const dictionaryEntry = Translations[key as DictionaryKey];
  
  if (!dictionaryEntry) {
    console.warn(`[I18n] Missing translation map for: ${key}`);
    return key;
  }
  
  return isSocial ? dictionaryEntry.social : dictionaryEntry.default;
}
