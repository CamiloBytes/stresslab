interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  tone?: "default" | "good" | "warning" | "bad";
  live?: boolean;
}

const TONES: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "text-sky",
  good: "text-mint",
  warning: "text-amber",
  bad: "text-rose",
};

export function MetricCard({ label, value, unit, detail, tone = "default", live = false }: MetricCardProps) {
  return (
    <article className="glass relative overflow-hidden rounded-xl px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-widest text-sky/45 uppercase">{label}</p>
        {live ? (
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-cyan-glow" aria-hidden="true" />
        ) : null}
      </div>
      <p className={`mt-1.5 font-mono text-2xl font-semibold ${TONES[tone]}`}>
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-sky/40">{unit}</span> : null}
      </p>
      {detail ? <p className="mt-1 truncate text-[11px] text-sky/40">{detail}</p> : null}
    </article>
  );
}
