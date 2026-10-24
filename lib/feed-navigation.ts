/**
 * Detect a deliberate browser reload without confusing Back/Forward navigation
 * for a reload. When Navigation Timing v2 is available, it is authoritative;
 * the legacy PerformanceNavigation API is only a fallback for older browsers.
 */
export type NavigationTimingEntry = { type?: string } | null | undefined;

export function isExplicitBrowserReload(
  navigationEntry: NavigationTimingEntry,
  legacyNavigationType: number | null | undefined,
): boolean {
  if (navigationEntry) return navigationEntry.type === "reload";
  return legacyNavigationType === 1;
}
