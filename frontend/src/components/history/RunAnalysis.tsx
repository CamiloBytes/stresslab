import { useState } from 'react';
import { api } from '../../lib/api';
import type { Run } from '../../lib/types';
import { Button } from '../ui/Button';

export function RunAnalysis({run}:{run:Run}) {
  const [analysis,setAnalysis]=useState(run.aiAnalysis);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [comparison,compare]=useState('');
  if(run.status==='running'||!run.summary?.requests)return null;
  return <section className="my-4 min-w-0 space-y-2 rounded-lg border border-line p-3 text-sm">
    <h3 className="font-semibold">Interpretación de rendimiento</h3>
    <Button variant="ghost" onClick={async()=>{try{const base=await api.baseline(run.id);compare(base?.summary && run.summary ? `Frente a ${new Date(base.startedAt).toLocaleString()}: p95 ${base.summary.p95Ms.toFixed(1)} → ${run.summary.p95Ms.toFixed(1)} ms; errores ${(100*base.summary.errorRate).toFixed(1)} → ${(100*run.summary.errorRate).toFixed(1)} %. Umbrales que antes pasaban y ahora fallan: ${run.summary.thresholds.filter(t=>!t.passed&&base.summary!.thresholds.some(old=>old.label===t.label&&old.passed)).map(t=>t.label).join(', ') || 'ninguno'}.`:'Sin corrida anterior comparable con la misma configuración y versión de reglas.');}catch{compare('No se pudo consultar la corrida anterior.');}}}>Comparar con corrida anterior</Button>{comparison&&<p className="break-words">{comparison}</p>}
    {analysis ? <><p className="break-words">{analysis.observations}</p><p className="break-words"><strong>Hipótesis:</strong> {analysis.hypotheses}</p><p className="break-words"><strong>Siguiente paso:</strong> {analysis.nextStep}</p><small className="break-words">{analysis.model} · {new Date(analysis.generatedAt).toLocaleString()}</small></> : <>
      <p className="text-xs text-sky/70">El proveedor recibe métricas agregadas y conteos de reglas.</p>
      <Button loading={busy} onClick={async()=>{setBusy(true);setError('');try{setAnalysis(await api.analyzeRun(run.id));}catch(e){setError(e instanceof Error?e.message:'Falló el análisis');}finally{setBusy(false);}}}>Analizar con IA</Button>
      {error && <p role="alert" className="break-words text-rose">{error}</p>}</>}
  </section>;
}
