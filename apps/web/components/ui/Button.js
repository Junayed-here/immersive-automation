const VARIANTS = {
  primary: 'bg-verdigris text-white hover:bg-verdigris-dark',
  secondary: 'bg-transparent text-ink border border-ink/20 hover:bg-ink/5',
  ghost: 'bg-transparent text-slate hover:bg-ink/5',
  danger: 'bg-danger text-white hover:opacity-90',
};

export function Button({ variant = 'primary', className = '', disabled, children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
