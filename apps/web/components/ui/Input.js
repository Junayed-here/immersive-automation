export function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
    </label>
  );
}

export function Input({ className = '', error, ...props }) {
  return (
    <input
      className={`w-full rounded border bg-surface px-3 py-2 text-sm text-ink placeholder:text-slate/60 focus:border-verdigris ${
        error ? 'border-danger' : 'border-line'
      } ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-verdigris ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-danger">{children}</p>;
}
