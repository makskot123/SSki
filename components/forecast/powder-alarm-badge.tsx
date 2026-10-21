/** Presentational badge; the caller supplies the translated label. */
export function PowderAlarmBadge({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-fg">
      {label}
    </span>
  );
}
