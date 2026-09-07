/**
 * The "title block" - a recurring device borrowed from architectural
 * drawings, used at the top of every authenticated page for a consistent
 * signature across the app rather than a one-off hero.
 */
export function PageHeader({ eyebrow, title, meta, actions }) {
  return (
    <div className="mb-6 border-b border-ink/15 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow ? (
            <div className="font-mono text-xs uppercase tracking-widest text-verdigris-dark">{eyebrow}</div>
          ) : null}
          <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="mt-2 font-mono text-xs text-slate">{meta}</div> : null}
    </div>
  );
}
