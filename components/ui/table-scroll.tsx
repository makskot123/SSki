/**
 * Horizontal scroll box for wide tables on phones. It is a named, focusable region so keyboard users can
 * scroll it (axe: scrollable-region-focusable), and `relative` so the table's visually hidden caption
 * (absolutely positioned) stays inside it instead of widening the page.
 */
export function TableScroll({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="relative overflow-x-auto rounded-lg border border-border"
    >
      {children}
    </div>
  );
}
