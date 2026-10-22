/** The app's main sections, shared by the header menu (wide screens) and the bottom tabs (phones). */
export const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/resorts", key: "resorts" },
  { href: "/avalanche", key: "avalanche" },
  { href: "/powder", key: "powder" },
  { href: "/track", key: "track" },
  { href: "/safety", key: "safety" },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]["key"];

/** Whether a section is the current one. Home matches only itself; other sections match their sub-pages. */
export function isActiveSection(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
