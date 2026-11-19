import { useEffect, useMemo, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import type {
  FindingSeverity,
  FindingStatus,
  SecurityAssessment,
  SecurityFinding,
} from "../../lib/types";
import { formatDateTime } from "../../lib/format";
import { Badge, type BadgeTone } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Panel } from "../ui/Panel";
import { SelectField, TextAreaField } from "../ui/Field";

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Informativa",
};

const STATUS_LABEL: Record<FindingStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  dismissed: "Descartada",
  remediated: "Remediada",
};

const STATUS_TONE: Record<FindingStatus, BadgeTone> = {
  pending: "warning",
  confirmed: "danger",
  dismissed: "neutral",
  remediated: "success",
};

export function severityTone(severity: FindingSeverity): BadgeTone {
  switch (severity) {
    case "critical":
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "info";
    default:
      return "neutral";
  }
}

interface AssessmentDetailProps {
  assessment: SecurityAssessment;
  findings: SecurityFinding[];
  aiAvailable: boolean;
  busy: boolean;
  onAnalyze: () => void;
  onFindingChange: (finding: SecurityFinding) => void;
  onBack: () => void;
}

export function AssessmentDetail({
  assessment,
  findings,
  aiAvailable,
  busy,
  onAnalyze,
  onFindingChange,
  onBack,
}: AssessmentDetailProps) {
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FindingStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(findings[0]?.id ?? null);

  const filtered = useMemo(() => {
    const list = findings.filter(
      (finding) =>
        (severityFilter === "all" || finding.severity === severityFilter) &&
        (statusFilter === "all" || finding.status === statusFilter),
    );
    return list.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [findings, severityFilter, statusFilter]);

  const selected = filtered.find((finding) => finding.id === selectedId) ?? filtered[0] ?? null;
  const summary = assessment.severitySummary;
  const [page,setPage] = useState(0);
  const currentPage = Math.min(page, Math.max(0,Math.ceil(filtered.length/50)-1));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-1 text-xs text-sky/45 transition-colors hover:text-cyan-glow"
          >
            ← Volver a evaluaciones
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-sky/90">{assessment.name}</h2>
            <Badge tone={assessment.status === "failed" ? "danger" : assessment.status === "analyzed" ? "success" : assessment.status === "analyzing" ? "info" : "neutral"}>
              {assessment.status === "imported"
                ? "Importada"
                : assessment.status === "analyzing"
                  ? "Analizando…"
                  : assessment.status === "analyzed"
                    ? "Analizada"
                    : "Falló el análisis"}
            </Badge>
            <Badge tone="neutral">{assessment.source}</Badge>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-sky/50" title={assessment.targetUrl}>
            {assessment.targetUrl} · {assessment.environment} · {formatDateTime(assessment.createdAt)}
          </p>
          {assessment.aiError ? (
            <p className="mt-2 rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-xs text-rose">
              {assessment.aiError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            className="px-3 py-1.5 text-xs"
            onClick={onAnalyze}
            disabled={busy || findings.length === 0 || !aiAvailable}
            title={
              !aiAvailable
                ? "Configura el proveedor de IA en el servidor"
                : findings.length === 0
                  ? "No hay hallazgos para analizar"
                  : undefined
            }
            loading={busy}
          >
            Analizar con IA
          </Button>
          <a
            href={api.assessmentReportUrl(assessment.id)}
            download
            className="inline-flex items-center justify-center rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-mint transition-colors hover:border-mint/50 hover:bg-mint/10"
          >
            Descargar PDF
          </a>
          <a
            href={api.assessmentReportUrl(assessment.id, true)}
            download
            className="inline-flex items-center justify-center rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-cyan-glow transition-colors hover:border-cyan-glow/50 hover:bg-cyan-glow/10"
            title="Incluye la última corrida de rendimiento del proyecto"
          >
            PDF + rendimiento
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["critical", "high", "medium", "low", "info"] as FindingSeverity[]).map((severity) => (
          <button
            key={severity}
            type="button"
            onClick={() => setSeverityFilter(severityFilter === severity ? "all" : severity)}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
              severityFilter === severity
                ? "border-cyan-glow/50 bg-cyan-glow/10"
                : "border-line bg-hull/50 hover:border-sky/30"
            }`}
          >
            <p className="text-[10px] tracking-wide text-sky/40 uppercase">{SEVERITY_LABEL[severity]}</p>
            <p
              className={`mt-0.5 font-mono text-lg font-semibold ${
                severity === "critical" || severity === "high"
                  ? "text-rose"
                  : severity === "medium"
                    ? "text-amber"
                    : "text-sky/85"
              }`}
            >
              {summary[severity] ?? 0}
            </p>
          </button>
        ))}
      </div>

      {assessment.aiAnalysis ? (
        <Panel
          title="Análisis asistido por IA"
          actions={<Badge tone="neutral">{assessment.aiAnalysis.model}</Badge>}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={severityTone(assessment.aiAnalysis.riskLevel)}>
                Riesgo: {SEVERITY_LABEL[assessment.aiAnalysis.riskLevel]}
              </Badge>
              <span className="font-mono text-[10px] text-sky/40">
                {formatDateTime(assessment.aiAnalysis.generatedAt)}
              </span>
            </div>
            <p className="text-sm text-sky/80">{assessment.aiAnalysis.summary}</p>
            <p className="text-sm leading-relaxed text-sky/65">{assessment.aiAnalysis.executiveSummary}</p>
            {assessment.aiAnalysis.technicalRecommendations.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {assessment.aiAnalysis.technicalRecommendations.map((item) => (
                  <li key={item} className="flex gap-2 text-xs text-sky/70">
                    <span className="text-mint">›</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="rounded-lg border border-amber/30 bg-amber/8 px-3 py-2 text-[11px] leading-relaxed text-amber/90">
              Interpretación asistida por IA a partir del reporte del escáner. No confirma vulnerabilidades
              explotadas ni sustituye la validación manual.
            </p>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title={`Hallazgos (${filtered.length}${filtered.length !== findings.length ? ` de ${findings.length}` : ""})`}
          bodyClassName="p-0"
          actions={
            <div className="flex gap-2">
              <select
                aria-label="Filtrar por severidad"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as FindingSeverity | "all")}
                className="rounded-lg border border-line bg-hull/70 px-2 py-1.5 text-xs text-sky/80 focus:border-cyan-glow/50 focus:outline-none"
              >
                <option value="all">Severidad: todas</option>
                {(["critical", "high", "medium", "low", "info"] as FindingSeverity[]).map((severity) => (
                  <option key={severity} value={severity}>
                    {SEVERITY_LABEL[severity]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar por estado"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as FindingStatus | "all")}
                className="rounded-lg border border-line bg-hull/70 px-2 py-1.5 text-xs text-sky/80 focus:border-cyan-glow/50 focus:outline-none"
              >
                <option value="all">Estado: todos</option>
                {(["pending", "confirmed", "dismissed", "remediated"] as FindingStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon="⬡"
              title="Sin hallazgos"
              description={
                findings.length === 0
                  ? "Este escaneo no registró alertas. Recuerda que la ausencia de alertas no demuestra que la aplicación sea segura."
                  : "Ningún hallazgo coincide con los filtros actuales."
              }
            />
          ) : (
            <div className="max-h-[540px] overflow-y-auto scrollbar-slim">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="sticky top-0 bg-hull/95">
                  <tr className="border-b border-line text-[11px] tracking-wide text-sky/40 uppercase">
                    <th className="px-4 py-3 font-medium">Sev.</th>
                    <th className="px-4 py-3 font-medium">Hallazgo</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(currentPage*50,currentPage*50+50).map((finding) => {
                    const active = selected?.id === finding.id;
                    return (
                      <tr
                        key={finding.id}
                        onClick={() => setSelectedId(finding.id)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") setSelectedId(finding.id);
                        }}
                        className={`cursor-pointer border-b border-line/60 transition-colors focus-visible:outline-none ${
                          active ? "bg-cyan-glow/8" : "hover:bg-sky/5"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <Badge tone={severityTone(finding.severity)}>
                            {SEVERITY_LABEL[finding.severity]}
                          </Badge>
                        </td>
                        <td className="max-w-[320px] px-4 py-3">
                          <p className="truncate text-sky/85">{finding.title}</p>
                          <p className="truncate font-mono text-[10px] text-sky/40">
                            {finding.method ?? ""} {finding.url ?? "sin endpoint"}
                            {finding.parameter ? ` · ${finding.parameter}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[finding.status]}>{STATUS_LABEL[finding.status]}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length>50 && <div className="flex justify-between p-2"><Button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Anterior</Button><span>{currentPage+1} / {Math.ceil(filtered.length/50)}</span><Button disabled={(currentPage+1)*50>=filtered.length} onClick={()=>setPage(currentPage+1)}>Siguiente</Button></div>}
            </div>
          )}
        </Panel>

        <div className="xl:sticky xl:top-20 xl:self-start">
          {selected ? (
            <FindingDetail finding={selected} onChange={onFindingChange} />
          ) : (
            <Panel title="Detalle del hallazgo">
              <p className="py-8 text-center text-xs text-sky/40">
                Selecciona un hallazgo para ver su evidencia y estado de revisión.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function FindingDetail({ finding, onChange }: { finding: SecurityFinding; onChange: (finding: SecurityFinding) => void }) {
  const [status, setStatus] = useState<FindingStatus>(finding.status);
  const [note, setNote] = useState(finding.reviewNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(finding.status);
    setNote(finding.reviewNote ?? "");
    setError(null);
  }, [finding]);

  const save = async (patch: { status?: FindingStatus; reviewNote?: string | null }) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.reviewFinding(finding.id, patch);
      onChange(updated);
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : "No se pudo guardar");
      setStatus(finding.status);
      setNote(finding.reviewNote ?? "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title={<span className="truncate text-sm font-semibold text-sky/90">{finding.title}</span>}
      actions={<Badge tone={severityTone(finding.severity)}>{SEVERITY_LABEL[finding.severity]}</Badge>}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Meta label="Regla" value={finding.ruleId} />
          <Meta
            label="Confianza del escáner"
            value={
              finding.scannerConfidence !== null
                ? `${Math.round(finding.scannerConfidence * 100)} %`
                : "no reportada"
            }
          />
          <Meta label="Método" value={finding.method ?? "—"} />
          <Meta label="Parámetro" value={finding.parameter ?? "—"} />
        </div>

        {finding.url ? (
          <div className="rounded-lg border border-line bg-hull/50 px-3 py-2">
            <p className="text-[10px] tracking-wide text-sky/40 uppercase">Endpoint</p>
            <p className="mt-1 break-all font-mono text-xs text-sky/75">{finding.url}</p>
          </div>
        ) : null}

        {finding.evidence ? (
          <div>
            <p className="mb-1 text-[10px] tracking-wide text-sky/40 uppercase">Evidencia del escáner</p>
            <p className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-hull/50 px-3 py-2 font-mono text-[11px] leading-relaxed text-sky/70 scrollbar-slim">
              {finding.evidence}
            </p>
          </div>
        ) : null}

        {finding.aiAnalysis ? (
          <div className="rounded-lg border border-cyan-glow/30 bg-cyan-glow/8 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] tracking-wide text-cyan-glow/80 uppercase">Análisis IA</p>
              <span className="font-mono text-[10px] text-sky/45">
                confianza {Math.round(finding.aiAnalysis.confidence * 100)}%
              </span>
            </div>
            <p className="text-xs leading-relaxed text-sky/75">{finding.aiAnalysis.impact}</p>
            <p className="mt-2 text-xs leading-relaxed text-mint/90">{finding.aiAnalysis.recommendation}</p>
            {finding.aiAnalysis.codeExample ? (
              <pre className="mt-2 overflow-x-auto rounded-md bg-void/60 p-2 font-mono text-[10px] leading-relaxed text-sky/70 scrollbar-slim">
                {finding.aiAnalysis.codeExample}
              </pre>
            ) : null}
            <p className="mt-2 text-[10px] text-amber/80">Sugerencia pendiente de validación manual.</p>
          </div>
        ) : finding.scannerSolution ? (
          <div>
            <p className="mb-1 text-[10px] tracking-wide text-sky/40 uppercase">Solución sugerida por ZAP</p>
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-sky/65 scrollbar-slim">
              {finding.scannerSolution}
            </p>
          </div>
        ) : null}

        {finding.reference ? (
          <p className="break-all text-[11px] text-sky/45">Referencia: {finding.reference}</p>
        ) : null}

        <div className="border-t border-line pt-3">
          <p className="mb-2 text-[10px] tracking-wide text-sky/40 uppercase">Revisión manual</p>
          <SelectField
            label="Estado"
            value={status}
            onChange={(event) => {
              const next = event.target.value as FindingStatus;
              setStatus(next);
              void save({ status: next });
            }}
            options={(["pending", "confirmed", "dismissed", "remediated"] as FindingStatus[]).map((value) => ({
              value,
              label: STATUS_LABEL[value],
            }))}
            hint="La revisión manual es tuya: la IA no cambia este estado."
          />
          <div className="mt-3">
            <TextAreaField
              label="Nota de revisión"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Por qué confirmas, descartas o remediaste este hallazgo…"
            />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              loading={saving}
              onClick={() => void save({ reviewNote: note.trim() ? note.trim() : null })}
            >
              Guardar nota
            </Button>
            {error ? <span className="text-xs text-rose">{error}</span> : null}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-hull/50 px-3 py-2">
      <p className="text-[10px] tracking-wide text-sky/40 uppercase">{label}</p>
      <p className="mt-0.5 truncate font-mono text-xs text-sky/80" title={value}>
        {value}
      </p>
    </div>
  );
}
