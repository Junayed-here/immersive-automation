export function AuthCard({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-2xl font-semibold text-ink">Ledger</div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-verdigris-dark">Listing Automation</div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-7">
          <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
