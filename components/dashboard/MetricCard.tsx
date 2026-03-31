interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
}

export function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-fuchsia-300/20 bg-card p-5 shadow-lg shadow-fuchsia-950/20">
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
      {subtitle ? <p className="mt-2 text-xs text-muted">{subtitle}</p> : null}
    </article>
  );
}
