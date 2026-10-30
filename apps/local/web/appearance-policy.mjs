// Saved, explicit opt-in policies. Legacy examples are never migrated implicitly.
export const APPEARANCE_MATCHER_VERSION='appearance-rgb-1';
export const APPEARANCE_FIXED_VERSION='appearance-rgb-fixed-1';
export function isAppearanceAlgorithm(algorithm){return algorithm===APPEARANCE_MATCHER_VERSION||algorithm===APPEARANCE_FIXED_VERSION;}
