import type { Health, LiveMetrics, Run, Scenario } from "../lib/types";
import type { LivePoint, StreamLog } from "../hooks/useRunStream";
import { formatElapsed, formatLatency, formatNumber, formatPercent, formatRps, statusLabel } from "../lib/format";
import { LiveChart } from "../components/charts/LiveChart";
import { LiveConsole } from "../components/dashboard/LiveConsole";
import { MetricCard } from "../components/dashboard/MetricCard";
import { RunControls } from "../components/dashboard/RunControls";
import { RunDetail, statusTone } from "../components/history/RunTable";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";

interface DashboardPageProps {
  scenarios: Scenario[];
  selectedId: string;
  onSelectScenario: (id: string) => void;
  activeRun: Run | null;
  live: LiveMetrics | null;
  series: LivePoint[];
  logs: StreamLog[];
  connected: boolean;
  health: Health | null;
  starting: boolean;
  recentRuns: Run[];
  selectedRun: Run | null;
  onSelectRun: (run: Run) => void;
  onRunAgain: (scenarioId: string) => void;
  runAgainDisabled: boolean;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
}

export function DashboardPage({
  scenarios,
  selectedId,
  onSelectScenario,
  activeRun,
  live,
  series,
  logs,
  connected,
  health,
  starting,
  recentRuns,
  selectedRun,
  onSelectRun,
  onRunAgain,
  runAgainDisabled,
  onStart,
  onStop,
  onClear,
}: DashboardPageProps) {
  const selectedIsActive = selectedRun !== null && selectedRun.id === activeRun?.id;
  const selectedLive = selectedIsActive ? live : null;
  const running = selectedIsActive && activeRun?.status === "running";
  const summary = selectedRun?.summary ?? null;
  const showSummary = !running && selectedRun !== null && summary !== null;

  const requests = selectedLive?.requests ?? summary?.requests ?? 0;
  const errorRate = selectedLive?.errorRate ?? summary?.errorRate ?? 0;
  const avgLatency = selectedLive?.avgLatencyMs ?? summary?.avgLatencyMs ?? 0;
  const rps = selectedLive?.rps ?? summary?.rps ?? 0;
  const vus = selectedLive?.vus ?? 0;
  const elapsed = selectedLive?.elapsedSec ?? summary?.durationSec ?? 0;
  const errorTone = errorRate > 0.01 ? "bad" : errorRate > 0 ? "warning" : "good";

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Control de prueba">
        <RunControls
          scenarios={scenarios}
          selectedId={selectedId}
          onSelect={onSelectScenario}
          activeRun={activeRun}
          starting={starting}
          connected={connected}
          onStart={onStart}
          onStop={onStop}
        />
        {health && !health.k6.available ? (
          <p className="mt-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber">
            k6 no está disponible. Instala Docker Desktop o ejecuta{" "}
            <code className="font-mono">winget install GrafanaLabs.k6</code> para poder lanzar pruebas.
          </p>
        ) : null}
        {activeRun && activeRun.status !== "running" ? (
          <div className="mt-3 flex items-center gap-3 text-xs text-sky/55">
            <Badge tone={statusTone(activeRun.status)}>{statusLabel(activeRun.status)}</Badge>
            <span className="truncate">{activeRun.scenarioName}</span>
            {activeRun.error ? <span className="text-rose">{activeRun.error}</span> : null}
          </div>
        ) : null}
      </Panel>

      <div className="flex items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 flex-1">
          <MetricCard label="RPS" value={formatRps(rps)} live={running} />
          <MetricCard label="Latencia media" value={formatLatency(avgLatency)} live={running} />
          <MetricCard
            label="Errores"
            value={formatPercent(errorRate)}
            tone={errorTone}
            live={running}
            detail={showSummary ? `${formatNumber(summary?.errors ?? 0)} fallidas` : undefined}
          />
          <MetricCard label="VUs activos" value={formatNumber(vus)} live={running} />
          <MetricCard label="Requests" value={formatNumber(requests)} live={running} />
          <MetricCard label="Tiempo" value={formatElapsed(elapsed)} live={running} />
        </div>
        <button
          type="button"
          onClick={onClear}
          title="Limpia la selección y las métricas del tablero"
          className="shrink-0 self-start rounded-lg border border-line px-3 py-2 text-xs font-medium text-sky/70 transition-colors hover:border-rose/40 hover:bg-rose/10 hover:text-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/40"
        >
          Limpiar
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Rendimiento en vivo" actions={<span className="font-mono text-[10px] text-sky/40">req/s</span>}>
          {selectedIsActive && series.length > 0 ? (
            <LiveChart
              data={series}
              series={[
                { key: "rps", color: "#00edff", label: "RPS" },
                { key: "vus", color: "#b595ff", label: "VUs" },
              ]}
            />
          ) : (
            <EmptyState
              icon="∿"
              title="Sin telemetría"
              description={selectedRun && !selectedIsActive
                ? "Esta corrida guarda el resumen final; la telemetría en vivo corresponde a la corrida activa."
                : "Inicia una prueba y verás la curva de RPS y usuarios activos en tiempo real."}
            />
          )}
        </Panel>

        <Panel title="Latencia y errores" actions={<span className="font-mono text-[10px] text-sky/40">ms / %</span>}>
          {selectedIsActive && series.length > 0 ? (
            <LiveChart
              data={series}
              series={[
                { key: "avgLatencyMs", color: "#abffe3", label: "Latencia media" },
                { key: "errorRate", color: "#ff3bae", label: "Tasa de error" },
              ]}
            />
          ) : (
            <EmptyState
              icon="⌁"
              title="Sin telemetría"
              description={selectedRun && !selectedIsActive
                ? "Esta corrida guarda el resumen final; la telemetría en vivo corresponde a la corrida activa."
                : "La latencia media y la tasa de error se graficarán durante la corrida."}
            />
          )}
        </Panel>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <LiveConsole logs={logs} running={running} />

        <div className="min-w-0">
        {selectedRun ? (
          <RunDetail run={selectedRun} onRunAgain={onRunAgain} runAgainDisabled={runAgainDisabled} />
        ) : (
          <Panel title="Resultado de la corrida">
            <EmptyState
              icon="◈"
              title="Todo listo para despegar"
              description="Elige un escenario arriba y pulsa «Iniciar prueba». El resumen con p95, p99 y umbrales aparecerá aquí."
            />
          </Panel>
        )}
        </div>
      </div>

      <Panel
        title="Corridas recientes"
        actions={
          <span className="text-[11px] text-sky/40">{recentRuns.length} en historial</span>
        }
      >
        {recentRuns.length === 0 ? (
          <p className="py-4 text-center text-xs text-sky/40">Todavía no hay corridas registradas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentRuns.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => onSelectRun(run)}
                  aria-pressed={run.id === selectedRun?.id}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow/60 ${
                    run.id === selectedRun?.id
                      ? "border-cyan-glow/45 bg-cyan-glow/10"
                      : "border-line/70 hover:border-cyan-glow/25 hover:bg-sky/5"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge tone={statusTone(run.status)} pulse={run.status === "running"}>
                      {statusLabel(run.status)}
                    </Badge>
                    <span className="truncate text-sm text-sky/75">{run.scenarioName}</span>
                  </div>
                  <div className="hidden shrink-0 gap-4 font-mono text-[11px] text-sky/50 sm:flex">
                    <span>
                      {formatNumber(run.summary?.requests ?? (run.id === activeRun?.id ? live?.requests : undefined) ?? 0)} req
                    </span>
                    <span>
                      {run.summary
                        ? formatLatency(run.summary.p95Ms)
                        : run.id === activeRun?.id && live
                          ? formatLatency(live.avgLatencyMs)
                          : "—"}
                    </span>
                    <span className={((run.summary?.errorRate ?? (run.id === activeRun?.id ? live?.errorRate : undefined)) ?? 0) > 0.01 ? "text-rose" : "text-mint"}>
                      {run.summary
                        ? formatPercent(run.summary.errorRate)
                        : run.id === activeRun?.id && live
                          ? formatPercent(live.errorRate)
                          : "—"}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
