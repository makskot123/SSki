/** iPhone/iPad Safari, where installing means "Share > Add to Home Screen" (there is no install prompt). */
export function needsIosInstallHelp(
  userAgent: string,
  standalone: boolean,
): boolean {
  if (standalone) return false;
  const ios = /iPhone|iPad|iPod/i.test(userAgent);
  // Other iOS browsers (Chrome, Firefox) cannot add web apps to the home screen in all versions; keep it simple.
  const safari =
    /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
  return ios && safari;
}

/** True when running as an installed app rather than in a browser tab. */
export function isStandaloneDisplay(
  matchMedia: (q: string) => { matches: boolean },
  navigatorStandalone: boolean | undefined,
): boolean {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    navigatorStandalone === true
  );
}

export const INSTALL_DISMISSED_KEY = "freeride-atlas:install-dismissed:v1";
