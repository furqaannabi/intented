/**
 * Loading placeholders. A Skeleton is a grey block in the shape of the value it stands for, so the page keeps its
 * layout when the data lands; the sweep animation lives in globals.css and stops under reduced motion.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block rounded-lg ${className}`} />;
}

/** A small ring for buttons that wait on the NEAR wallet connector; "dark" for use on a lime button. */
export function Spinner({ tone = "light" }: { tone?: "light" | "dark" }) {
  const ring = tone === "dark" ? "border-black/25 border-t-lime-ink" : "border-[#444] border-t-soft";
  return <span aria-hidden="true" className={`spinner inline-block size-3 shrink-0 rounded-full border-2 ${ring}`} />;
}

/** Announces the wait to screen readers once, since the blocks themselves are hidden from them. */
export function Loading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
