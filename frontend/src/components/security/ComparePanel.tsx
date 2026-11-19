import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import type { AssessmentComparison, ComparisonFinding, FindingSeverity } from "../../lib/types";
import { formatDateTime } from "../../lib/format";
import { Badge, type BadgeTone } from "../ui/Badge";
import { Panel } from "../ui/Panel";
import { SelectField } from "../ui/Field";

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Informativa",
};

function severityTone(severity: FindingSeverity): BadgeTone {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  if (severity === "low") return "info";
  return "neutral";
}

interface ComparePanelProps {
  options: Array<{ id: string; name: string; createdAt: string }>;
  onClose: () => void;
}

export function ComparePanel({ options, onClose }: ComparePanelProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [comparison, setComparison] = useState<AssessmentComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (options.length >= 2 && !from && !to) {
      setFrom(options[1].id);
      setTo(options[0].id);
    }
  }, [options, from, to]);

  const run = async () => {
    if (!from || !to) return;
    if (from === to) {
      setError("Selecciona dos evaluaciones distintas");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.compareAssessments(from, to);
      setComparison(result);
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : "No se pudo comparar");
      setComparison(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel
      title="Comparar evaluaciones"
      actions={
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-sky/45 transition-colors hover:text-cyan-glow"
        >
          Cerrar
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs leading-relaxed text-sky/50">
          Compara dos evaluaciones del mismo proyecto por identidad estable de hallazgo (regla + método +
          endpoint + parámetro). <strong className="text-sky/75">«No observado» no equivale a «corregido»</strong>:
          solo indica que la alerta no apareció en la segunda evaluación.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <SelectField
            label="Evaluación anterior"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            options={options.map((item) => ({
              value: item.id,
              label: `${item.name} (${formatDateTime(item.createdAt)})`,
            }))}
          />
          <SelectField
            label="Evaluación posterior"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            options={options.map((item) => ({
              value: item.id,
              label: `${item.name} (${formatDateTime(item.createdAt)})`,
            }))}
          />
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading || !from || !to}
            className="h-[38px] rounded-lg border border-cyan-glow/45 bg-cyan-glow/15 px-4 text-sm font-medium text-cyan-glow transition-all hover:bg-cyan-glow/25 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? "Comparando…" : "Comparar"}
          </button>
        </div>

        {error ? <p className="text-xs text-rose">{error}</p> : null}

        {comparison ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <ComparisonColumn
              title="Persistentes"
              tone="warning"
              description="Aparecen en ambas evaluaciones"
              items={comparison.persistent}
            />
            <ComparisonColumn
              title="Nuevos"
              tone="danger"
              description="Solo en la evaluación posterior"
              items={comparison.new}
            />
            <ComparisonColumn
              title="No observados"
              tone="neutral"
              description="Solo en la anterior — sin confirmar si se corrigieron"
              items={comparison.notObserved}
            />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function ComparisonColumn({
  title,
  description,
  tone,
  items,
}: {
  title: string;
  description: string;
  tone: BadgeTone;
  items: ComparisonFinding[];
}) {
  return (
    <div className="rounded-xl border border-line bg-hull/40 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-sky/85">{title}</p>
        <Badge tone={tone}>{items.length}</Badge>
      </div>
      <p className="mb-3 text-[11px] text-sky/40">{description}</p>
      {items.length === 0 ? (
        <p className="text-xs text-sky/35">Sin elementos.</p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto scrollbar-slim">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-line/70 bg-void/30 px-2.5 py-2">
              <div className="mb-1 flex items-center gap-2">
                <Badge tone={severityTone(item.severity)}>{SEVERITY_LABEL[item.severity]}</Badge>
              </div>
              <p className="truncate text-xs text-sky/80" title={item.title}>
                {item.title}
              </p>
              <p className="truncate font-mono text-[10px] text-sky/40">
                {item.method ?? ""} {item.url ?? ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
