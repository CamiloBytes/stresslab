import type { Run, Scenario } from "../../lib/types";
import { statusLabel } from "../../lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

interface RunControlsProps {
  scenarios: Scenario[];
  selectedId: string;
  onSelect: (id: string) => void;
  activeRun: Run | null;
  starting: boolean;
  connected: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function RunControls({
  scenarios,
  selectedId,
  onSelect,
  activeRun,
  starting,
  connected,
  onStart,
  onStop,
}: RunControlsProps) {
  const running = activeRun?.status === "running";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium tracking-wide text-sky/60">Escenario</span>
        <select
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
          disabled={running || starting}
          className="w-full rounded-lg border border-line bg-hull/70 px-3 py-2 text-sm text-sky/90 focus:border-cyan-glow/50 focus:ring-1 focus:ring-cyan-glow/40 focus:outline-none disabled:opacity-50"
        >
          {scenarios.length === 0 ? <option value="">Sin escenarios</option> : null}
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id} className="bg-hull text-sky">
              {scenario.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3">
        {running ? (
          <Button variant="danger" onClick={onStop} disabled={!connected}>
            Terminar
          </Button>
        ) : (
          <Button variant="primary" onClick={onStart} loading={starting} disabled={!selectedId}>
            Iniciar prueba
          </Button>
        )}

        {running ? (
          <Badge tone="info" pulse>
            {statusLabel("running")}
          </Badge>
        ) : activeRun ? (
          <Badge
            tone={
              activeRun.status === "completed" || activeRun.status === "stopped"
                ? "success"
                : activeRun.status === "failed"
                  ? "danger"
                  : "warning"
            }
          >
            {statusLabel(activeRun.status)}
          </Badge>
        ) : (
          <Badge tone={connected ? "success" : "warning"} pulse={!connected}>
            {connected ? "Telemetría en vivo" : "Sin conexión"}
          </Badge>
        )}

        {starting ? <Spinner size={14} className="text-cyan-glow" /> : null}
      </div>
    </div>
  );
}
