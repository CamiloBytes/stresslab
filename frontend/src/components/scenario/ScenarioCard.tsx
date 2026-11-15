import type { Scenario } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

interface ScenarioCardProps {
  scenario: Scenario;
  disabled: boolean;
  onRun: (scenario: Scenario) => void;
  onEdit: (scenario: Scenario) => void;
  onDelete: (scenario: Scenario) => void;
}

function loadSummary(scenario: Scenario): string {
  if (scenario.loadMode === "constant-arrival-rate") {
    return `${scenario.arrivalRate ?? 0} req/s durante ${scenario.duration ?? "—"}`;
  }
  const peak = scenario.stages.reduce((max, stage) => Math.max(max, stage.target), 0);
  const total = scenario.stages.reduce((sum, stage) => sum + parseDuration(stage.duration), 0);
  return `pico ${peak} VUs · ${formatTotal(total)}`;
}

function parseDuration(value: string): number {
  const match = /^(\d+)([smh])$/.exec(value);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (match[2] === "h") return amount * 3600;
  if (match[2] === "m") return amount * 60;
  return amount;
}

function formatTotal(seconds: number): string {
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${seconds} s`;
}

export function ScenarioCard({ scenario, disabled, onRun, onEdit, onDelete }: ScenarioCardProps) {
  const isWeb = scenario.type === "web";

  return (
    <Panel
      className="h-full"
      title={
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-sky/90">{scenario.name}</span>
          <Badge tone={isWeb ? "warning" : "info"}>{isWeb ? "WEB" : "API"}</Badge>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => onRun(scenario)} disabled={disabled}>
            Ejecutar
          </Button>
          <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => onEdit(scenario)}>
            Editar
          </Button>
          <Button variant="quiet" className="px-2 py-1.5 text-xs" onClick={() => onDelete(scenario)}>
            Eliminar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded border border-violet/40 bg-violet/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet">
            {scenario.method}
          </span>
          <code className="truncate font-mono text-xs text-sky/60" title={scenario.url}>
            {scenario.url}
          </code>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-sky/45">
          <span>{loadSummary(scenario)}</span>
          <span>think {scenario.thinkTime}s</span>
          {scenario.thresholds.p95Ms ? <span>p95 &lt; {scenario.thresholds.p95Ms} ms</span> : null}
          {scenario.thresholds.maxErrorRate !== null ? (
            <span>errores &lt; {(scenario.thresholds.maxErrorRate * 100).toFixed(0)}%</span>
          ) : null}
          {Object.keys(scenario.headers).length > 0 ? <span>{Object.keys(scenario.headers).length} headers</span> : null}
        </div>
      </div>
    </Panel>
  );
}
