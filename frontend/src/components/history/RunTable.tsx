import type { Run } from "../../lib/types";
import { formatDateTime, formatElapsed, formatLatency, formatNumber, formatPercent, statusLabel } from "../../lib/format";
import { Badge, type BadgeTone } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Panel } from "../ui/Panel";

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "running":
      return "info";
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "stopped":
      return "success";
    default:
      return "neutral";
  }
}

interface RunTableProps {
  runs: Run[];
  selectedId: string | null;
  onSelect: (run: Run) => void;
}

export function RunTable({ runs, selectedId, onSelect }: RunTableProps) {
  if (runs.length === 0) {
    return (
      <EmptyState
        icon="◷"
        title="Aún no hay corridas"
        description="Cuando ejecutes un escenario, su historial aparecerá aquí con métricas y umbrales."
      />
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-slim">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[11px] tracking-wide text-sky/40 uppercase">
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Escenario</th>
            <th className="px-4 py-3 font-medium">Inicio</th>
            <th className="px-4 py-3 font-medium">Duración</th>
            <th className="px-4 py-3 font-medium">Requests</th>
            <th className="px-4 py-3 font-medium">p95</th>
            <th className="px-4 py-3 font-medium">Errores</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const selected = run.id === selectedId;
            return (
              <tr
                key={run.id}
                onClick={() => onSelect(run)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSelect(run);
                }}
                className={`cursor-pointer border-b border-line/60 transition-colors focus-visible:bg-cyan-glow/10 focus-visible:outline-none ${
                  selected ? "bg-cyan-glow/8" : "hover:bg-sky/5"
                }`}
              >
                <td className="px-4 py-3">
                  <Badge tone={statusTone(run.status)} pulse={run.status === "running"}>
                    {statusLabel(run.status)}
                  </Badge>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-sky/80">{run.scenarioName}</td>
                <td className="px-4 py-3 font-mono text-sky/50">{formatDateTime(run.startedAt)}</td>
                <td className="px-4 py-3 font-mono text-sky/50">
                  {run.summary ? formatElapsed(run.summary.durationSec) : run.status === "running" ? "…" : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-sky/70">
                  {run.summary ? formatNumber(run.summary.requests) : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-sky/70">
                  {run.summary ? formatLatency(run.summary.p95Ms) : "—"}
                </td>
                <td className="px-4 py-3 font-mono">
                  {run.summary ? (
                    <span className={run.summary.errorRate > 0.01 ? "text-rose" : "text-mint"}>
                      {formatPercent(run.summary.errorRate)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface RunDetailProps {
  run: Run;
  onRunAgain?: (scenarioId: string) => void;
}

export function RunDetail({ run, onRunAgain }: RunDetailProps) {
  const summary = run.summary;

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-sky/90">{run.scenarioName}</span>
          <Badge tone={statusTone(run.status)}>{statusLabel(run.status)}</Badge>
        </div>
      }
      actions={
        <>
          {run.status !== "running" && onRunAgain ? (
            <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => onRunAgain(run.scenarioId)}>
              Volver a ejecutar
            </Button>
          ) : null}
          <span className="font-mono text-[10px] text-sky/40">{run.id.slice(0, 8)}</span>
        </>
      }
    >
      {run.error ? <p className="mb-3 text-xs text-rose">{run.error}</p> : null}

      {summary && summary.thresholds.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {summary.thresholds.map((threshold) => (
            <span
              key={threshold.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                threshold.passed
                  ? "border-mint/40 bg-mint/10 text-mint"
                  : "border-rose/40 bg-rose/10 text-rose"
              }`}
            >
              <span aria-hidden="true">{threshold.passed ? "✓" : "✕"}</span>
              {threshold.label}
            </span>
          ))}
        </div>
      ) : null}

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <DetailStat label="Requests" value={formatNumber(summary.requests)} />
          <DetailStat label="RPS promedio" value={summary.rps.toFixed(1)} />
          <DetailStat label="Duración" value={formatElapsed(summary.durationSec)} />
          <DetailStat label="Latencia media" value={formatLatency(summary.avgLatencyMs)} />
          <DetailStat label="p95" value={formatLatency(summary.p95Ms)} />
          <DetailStat label="p99" value={formatLatency(summary.p99Ms)} />
          <DetailStat label="Errores" value={formatNumber(summary.errors)} tone={summary.errorRate > 0 ? "bad" : "good"} />
          <DetailStat label="Tasa de error" value={formatPercent(summary.errorRate)} tone={summary.errorRate > 0.01 ? "bad" : "good"} />
          <DetailStat label="Iteraciones" value={formatNumber(summary.iterations)} />
        </div>
      ) : (
        <p className="text-xs text-sky/45">Sin resumen disponible{run.status === "running" ? " — la corrida sigue en curso" : ""}.</p>
      )}

      <p className="mt-4 font-mono text-[10px] text-sky/35">
        iniciado {formatDateTime(run.startedAt)}
        {run.endedAt ? ` · finalizado ${formatDateTime(run.endedAt)}` : ""}
      </p>
    </Panel>
  );
}

function DetailStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-mint" : tone === "bad" ? "text-rose" : "text-sky/90";
  return (
    <div className="rounded-lg border border-line bg-hull/50 px-3 py-2.5">
      <p className="text-[10px] tracking-wide text-sky/40 uppercase">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
