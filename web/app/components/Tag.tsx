/** A small mono tag: "Base" beside a Base address, dashed "simulated" on a delivery nothing real made. */
export function Tag({ children, dashed }: { children: React.ReactNode; dashed?: boolean }) {
  return (
    <span
      className={`inline-block rounded-md border border-line px-1.5 py-px align-middle font-mono text-[11px] font-medium tracking-[0.04em] uppercase ${
        dashed ? "border-dashed text-mute" : "text-soft"
      }`}
    >
      {children}
    </span>
  );
}
