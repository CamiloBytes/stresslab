import { useEffect, useState } from "react";
import type { Run, SecurityAssessment } from "../lib/types";
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { SegmentedControl } from '../components/ui/Field';
import { RunDetail, RunTable } from "../components/history/RunTable";
import { Panel } from "../components/ui/Panel";

interface HistoryPageProps {
  runs: Run[];
  loading: boolean;
  onRunAgain: (scenarioId: string) => void;
  runAgainDisabled: boolean;
}

export function HistoryPage({ runs, loading, onRunAgain, runAgainDisabled }: HistoryPageProps) {
  const [selected, setSelected] = useState<Run | null>(null);
  const [section,setSection] = useState<'stress'|'security'>('stress');

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
    <div className="space-y-4">
    <div className="max-w-sm"><SegmentedControl label="Tipo de historial" value={section} onChange={setSection} options={[{value:'stress',label:'Pruebas de estrés'},{value:'security',label:'Seguridad'}]}/></div>
    {section==='security' ? <SecurityHistory/> : (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[1.6fr_1fr]">
      <Panel title="Historial de corridas" bodyClassName="p-0">
        {loading ? (
          <p className="px-4 py-6 text-center text-xs text-sky/40">Cargando historial…</p>
        ) : (
          <RunTable runs={runs} selectedId={selected?.id ?? null} onSelect={setSelected} />
        )}
      </Panel>

      <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">
        {selected ? (
          <RunDetail run={selected} onRunAgain={onRunAgain} runAgainDisabled={runAgainDisabled} />
        ) : (
          <Panel title="Detalle de la corrida">
            <p className="py-8 text-center text-xs text-sky/40">
              Selecciona una corrida de la tabla para ver su resumen completo.
            </p>
          </Panel>
        )}
      </div>
    </div>
    )}</div>
  );
}

function SecurityHistory() {
  const [items,setItems] = useState<SecurityAssessment[] | null>(null);
  const [error,setError] = useState(false);
  const [attempt,retry] = useState(0);
  useEffect(()=>{
    let current=true;
    setError(false);
    api.listAssessments().then(({assessments})=>{if(current)setItems(assessments);}).catch(()=>{if(current)setError(true);});
    return ()=>{current=false;};
  },[attempt]);
  return <Panel title="Historial de seguridad">
    {error ? <p role="alert">No se pudo cargar el historial. <button className="underline" onClick={()=>retry(n=>n+1)}>Reintentar</button></p> : !items ? <p role="status">Cargando evaluaciones…</p> : !items.length ? <p>Aún no hay evaluaciones. Registra la primera en Seguridad.</p> :
      <ul className="divide-y divide-line">{items.map(a=><li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="font-semibold">{a.name}</p><p className="break-all text-xs text-sky/70">{a.targetUrl}</p><p className="mt-1 text-xs text-sky/70">{formatDateTime(a.createdAt)} · {a.findingCount} hallazgos</p></div>
        <a className="text-sm text-cyan-glow underline underline-offset-4" href={api.assessmentReportUrl(a.id)} download aria-label={`Descargar PDF de ${a.name}`}>Descargar PDF</a>
      </li>)}</ul>}
  </Panel>;
}
