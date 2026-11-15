import { useEffect, useState } from "react";
import type { Run } from "../lib/types";
import { RunDetail, RunTable } from "../components/history/RunTable";
import { Panel } from "../components/ui/Panel";

interface HistoryPageProps {
  runs: Run[];
  loading: boolean;
  onRunAgain: (scenarioId: string) => void;
}

export function HistoryPage({ runs, loading, onRunAgain }: HistoryPageProps) {
  const [selected, setSelected] = useState<Run | null>(null);

  useEffect(() => {
    if (runs.length === 0) {
      setSelected(null);
      return;
    }
    setSelected((previous) => {
      if (!previous) return runs[0];
      return runs.find((run) => run.id === previous.id) ?? runs[0];
    });
  }, [runs]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <Panel title="Historial de corridas" bodyClassName="p-0">
        {loading ? (
          <p className="px-4 py-6 text-center text-xs text-sky/40">Cargando historial…</p>
        ) : (
          <RunTable runs={runs} selectedId={selected?.id ?? null} onSelect={setSelected} />
        )}
      </Panel>

      <div className="xl:sticky xl:top-20 xl:self-start">
        {selected ? (
          <RunDetail run={selected} onRunAgain={onRunAgain} />
        ) : (
          <Panel title="Detalle de la corrida">
            <p className="py-8 text-center text-xs text-sky/40">
              Selecciona una corrida de la tabla para ver su resumen completo.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
