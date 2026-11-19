import { useCallback, useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import type {
  AssessmentImportInput,
  Project,
  ProjectInput,
  SecurityAssessment,
  SecurityFinding,
} from "../lib/types";
import { formatDateTime } from "../lib/format";
import { AssessmentDetail, severityTone } from "../components/security/AssessmentDetail";
import { ComparePanel } from "../components/security/ComparePanel";
import { ImportModal } from "../components/security/ImportModal";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { SelectField, TextField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Informativa",
};

function statusTone(status: SecurityAssessment["status"]): BadgeTone {
  if (status === "failed") return "danger";
  if (status === "analyzed") return "success";
  if (status === "analyzing") return "info";
  return "neutral";
}

interface SecurityPageProps {
  projects: Project[];
  loadingProjects: boolean;
  onProjectsChange: () => Promise<void>;
  onToast: (message: string, kind?: "info" | "success" | "error") => void;
}

export function SecurityPage({ projects, loadingProjects, onProjectsChange, onToast }: SecurityPageProps) {
  const [projectId, setProjectId] = useState("");
  const [assessments, setAssessments] = useState<SecurityAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [selected, setSelected] = useState<{
    assessment: SecurityAssessment;
    findings: SecurityFinding[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectInput>({
    name: "",
    environment: "staging",
    scope: [],
  });
  const [scopeText, setScopeText] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listAssessments(projectId || undefined);
      setAssessments(result.assessments);
      setAiAvailable(result.aiAvailable);
    } catch {
      onToast("No se pudieron cargar las evaluaciones", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, onToast]);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  const openDetail = async (assessment: SecurityAssessment) => {
    try {
      const result = await api.getAssessment(assessment.id);
      setSelected(result);
    } catch {
      onToast("No se pudo abrir la evaluación", "error");
    }
  };

  const handleImport = async (input: AssessmentImportInput) => {
    const created = await api.importAssessment(input);
    onToast(`Evaluación «${created.name}» importada con ${created.findingCount} hallazgos.`, "success");
    await loadAssessments();
    await openDetail(created);
  };

  const handleAnalyze = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const assessment = await api.analyzeAssessment(selected.assessment.id);
      const refreshed = await api.getAssessment(assessment.id);
      setSelected(refreshed);
      setAssessments((previous) =>
        previous.map((item) => (item.id === assessment.id ? assessment : item)),
      );
      onToast("Análisis IA completado.", "success");
    } catch (requestError) {
      const message =
        requestError instanceof ApiRequestError ? requestError.message : "Falló el análisis IA";
      onToast(message, "error");
      await loadAssessments();
    } finally {
      setBusy(false);
    }
  };

  const handleFindingChange = (finding: SecurityFinding) => {
    setSelected((previous) =>
      previous
        ? {
            ...previous,
            findings: previous.findings.map((item) => (item.id === finding.id ? finding : item)),
          }
        : previous,
    );
  };

  const createProject = async () => {
    setProjectError(null);
    if (!projectForm.name.trim()) {
      setProjectError("Ponle un nombre al proyecto");
      return;
    }
    const scope = scopeText
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    setSavingProject(true);
    try {
      const created = await api.createProject({ ...projectForm, name: projectForm.name.trim(), scope });
      await onProjectsChange();
      setProjectId(created.id);
      setProjectModalOpen(false);
      setProjectForm({ name: "", environment: "staging", scope: [] });
      setScopeText("");
      onToast(`Proyecto «${created.name}» creado.`, "success");
    } catch (requestError) {
      setProjectError(requestError instanceof Error ? requestError.message : "No se pudo crear");
    } finally {
      setSavingProject(false);
    }
  };

  const currentProject = projects.find((project) => project.id === projectId) ?? null;
  const projectAssessments = assessments;
  const hasScope = (currentProject?.scope.length ?? 0) > 0;

  if (selected) {
    return (
      <AssessmentDetail
        assessment={selected.assessment}
        findings={selected.findings}
        aiAvailable={aiAvailable}
        busy={busy}
        onAnalyze={() => void handleAnalyze()}
        onFindingChange={handleFindingChange}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <SelectField
              label="Proyecto"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              options={projects.map((project) => ({
                value: project.id,
                label: `${project.name} · ${project.environment}`,
              }))}
              hint={loadingProjects ? "Cargando…" : undefined}
            />
          </div>
          <Button variant="ghost" className="px-3 py-2 text-xs" onClick={() => setProjectModalOpen(true)}>
            + Proyecto
          </Button>
          {currentProject && hasScope ? (
            <Badge tone="info" title={currentProject.scope.join(", ")}>
              alcance: {currentProject.scope.length} URL{currentProject.scope.length === 1 ? "" : "s"}
            </Badge>
          ) : currentProject ? (
            <Badge tone="warning" title="Sin alcance declarado: cualquier objetivo es aceptado">
              sin alcance declarado
            </Badge>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="px-3 py-2 text-xs"
            onClick={() => setCompareOpen((value) => !value)}
            disabled={projectAssessments.length < 2}
            title={projectAssessments.length < 2 ? "Se necesitan al menos 2 evaluaciones" : undefined}
          >
            Comparar evaluaciones
          </Button>
          <Button
            variant="primary"
            onClick={() => setImportOpen(true)}
            disabled={!projectId}
            title={!projectId ? "Crea un proyecto primero" : undefined}
          >
            + Importar reporte ZAP
          </Button>
        </div>
      </div>

      {!aiAvailable ? (
        <p className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-xs leading-relaxed text-amber/90">
          Análisis IA no configurado. Define <code className="font-mono">BEDROCK_MODEL_ID</code>,{" "}
          <code className="font-mono">AWS_REGION</code>, <code className="font-mono">AWS_ACCESS_KEY_ID</code> y{" "}
          <code className="font-mono">AWS_SECRET_ACCESS_KEY</code> para habilitar la interpretación de hallazgos con
          Amazon Bedrock. La importación y revisión funcionan sin IA.
        </p>
      ) : null}

      {compareOpen ? (
        <ComparePanel
          options={projectAssessments.map((item) => ({
            id: item.id,
            name: item.name,
            createdAt: item.createdAt,
          }))}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}

      <Panel title="Evaluaciones de seguridad" bodyClassName="p-0">
        {loading ? (
          <p className="px-5 py-6 text-center text-xs text-sky/40">Cargando evaluaciones…</p>
        ) : projectAssessments.length === 0 ? (
          <EmptyState
            icon="⬡"
            title="Sin evaluaciones todavía"
            description={
              projectId
                ? "Importa un reporte JSON de OWASP ZAP para normalizar sus alertas como hallazgos revisables con análisis IA opcional."
                : "Crea o selecciona un proyecto para comenzar a evaluar seguridad."
            }
            action={
              projectId ? (
                <Button variant="primary" onClick={() => setImportOpen(true)}>
                  Importar reporte ZAP
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setProjectModalOpen(true)}>
                  Crear proyecto
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[11px] tracking-wide text-sky/40 uppercase">
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Evaluación</th>
                  <th className="px-4 py-3 font-medium">Objetivo</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Hallazgos</th>
                  <th className="px-4 py-3 font-medium">Severidades</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {projectAssessments.map((assessment) => (
                  <tr
                    key={assessment.id}
                    onClick={() => void openDetail(assessment)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void openDetail(assessment);
                    }}
                    className="cursor-pointer border-b border-line/60 transition-colors hover:bg-sky/5 focus-visible:bg-cyan-glow/10 focus-visible:outline-none"
                  >
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(assessment.status)} pulse={assessment.status === "analyzing"}>
                        {assessment.status === "imported"
                          ? "Importada"
                          : assessment.status === "analyzing"
                            ? "Analizando"
                            : assessment.status === "analyzed"
                              ? "Analizada"
                              : "Falló"}
                      </Badge>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-sky/85">{assessment.name}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 font-mono text-sky/50" title={assessment.targetUrl}>
                      {assessment.targetUrl}
                    </td>
                    <td className="px-4 py-3 font-mono text-sky/50">{formatDateTime(assessment.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-sky/70">{assessment.findingCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(["critical", "high", "medium", "low"] as const)
                          .filter((severity) => (assessment.severitySummary[severity] ?? 0) > 0)
                          .map((severity) => (
                            <Badge key={severity} tone={severityTone(severity)}>
                              {SEVERITY_LABEL[severity]} {assessment.severitySummary[severity]}
                            </Badge>
                          ))}
                        {(assessment.severitySummary.critical ?? 0) +
                          (assessment.severitySummary.high ?? 0) +
                          (assessment.severitySummary.medium ?? 0) +
                          (assessment.severitySummary.low ?? 0) ===
                        0 ? (
                          <span className="text-sky/40">—</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-cyan-glow/80">Ver →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ImportModal
        open={importOpen}
        projects={projects}
        defaultProjectId={projectId}
        onClose={() => setImportOpen(false)}
        onSubmit={handleImport}
      />

      <Modal
        open={projectModalOpen}
        title="Nuevo proyecto"
        onClose={() => setProjectModalOpen(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setProjectModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={savingProject} onClick={() => void createProject()}>
              Crear proyecto
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Nombre"
            placeholder="API — Pedidos"
            value={projectForm.name}
            onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <SelectField
            label="Entorno"
            value={projectForm.environment}
            onChange={(event) =>
              setProjectForm((prev) => ({
                ...prev,
                environment: event.target.value as ProjectInput["environment"],
              }))
            }
            options={[
              { value: "local", label: "Local" },
              { value: "staging", label: "Staging" },
              { value: "production", label: "Producción" },
              { value: "other", label: "Otro" },
            ]}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-sky/60">Alcance autorizado (opcional)</span>
            <textarea
              rows={3}
              value={scopeText}
              onChange={(event) => setScopeText(event.target.value)}
              placeholder={"https://api.ejemplo.com\nhttps://app.ejemplo.com"}
              className="w-full rounded-lg border border-line bg-hull/70 px-3 py-2 font-mono text-xs text-sky/90 placeholder:text-sky/30 focus:border-cyan-glow/50 focus:outline-none"
            />
            <span className="text-xs text-sky/40">
              Una URL por línea. Si defines alcance, solo se aceptarán reportes de esos dominios.
            </span>
          </label>
          {projectError ? (
            <p className="rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-xs text-rose">{projectError}</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
