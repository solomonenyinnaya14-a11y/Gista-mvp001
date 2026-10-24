/**
 * Detect a deliberate browser reload without confusing Back/Forward navigation
 * for a reload. Safari can restore a document through its history cache while
 * exposing inconsistent Navigation Timing APIs; when the APIs disagree and the
 * legacy API explicitly reports Back/Forward, preserve the current feed snapshot.
 */
export type NavigationTimingEntry = { type?: string } | null | undefined;

export function isExplicitBrowserReload(
  navigationEntry: NavigationTimingEntry,
  legacyNavigationType: number | null | undefined,
): boolean {
  // A legacy Back/Forward signal is the strongest evidence that this visit is
  // history navigation, not a user-requested refresh.
  if (legacyNavigationType === 2) return false;
  if (navigationEntry) return navigationEntry.type === "reload";
  return legacyNavigationType === 1;
}
