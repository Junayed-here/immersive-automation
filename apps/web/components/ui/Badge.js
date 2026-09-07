const TONES = {
  neutral: 'bg-ink/5 text-slate',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  copper: 'bg-copper/10 text-copper',
  verdigris: 'bg-verdigris/10 text-verdigris-dark',
};

export function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${TONES[tone]}`}>
      {children}
    </span>
  );
}
