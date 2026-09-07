export function Card({ className = '', children }) {
  return <div className={`rounded-lg border border-line bg-surface ${className}`}>{children}</div>;
}

export function CardBody({ className = '', children }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
