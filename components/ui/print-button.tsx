"use client";

/** Opens the browser's print dialog (the page's print CSS hides navigation and forms). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent print:hidden"
    >
      {label}
    </button>
  );
}
