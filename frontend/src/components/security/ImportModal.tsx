import { useRef, useState } from "react";
import { ApiRequestError } from "../../lib/api";
import type { Project, ProjectEnvironment } from "../../lib/types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { SelectField, TextField } from "../ui/Field";

interface ImportModalProps {
  open: boolean;
  projects: Project[];
  defaultProjectId: string;
  onClose: () => void;
  onSubmit: (input: {
    projectId: string;
    name: string;
    targetUrl: string;
    environment?: ProjectEnvironment;
    report: unknown;
  }) => Promise<void>;
}

const ENVIRONMENTS: Array<{ value: ProjectEnvironment; label: string }> = [
  { value: "local", label: "Local" },
  { value: "staging", label: "Staging" },
  { value: "production", label: "Producción" },
  { value: "other", label: "Otro" },
];

export function ImportModal({ open, projects, defaultProjectId, onClose, onSubmit }: ImportModalProps) {
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [environment, setEnvironment] = useState<ProjectEnvironment | "">("");
  const [reportText, setReportText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setProjectId(defaultProjectId);
    setName("");
    setTargetUrl("");
    setEnvironment("");
    setReportText("");
    setFileName(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("El archivo supera el límite de 8 MB");
      return;
    }
    const text = await file.text();
    setReportText(text);
    setFileName(file.name);
    if (!name) setName(file.name.replace(/\.json$/i, ""));
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!projectId) return setError("Selecciona un proyecto");
    if (!name.trim()) return setError("Ponle un nombre a la evaluación");
    if (!/^https?:\/\/.+/i.test(targetUrl.trim())) return setError("URL http(s) del objetivo requerida");
    if (!reportText.trim()) return setError("Pega o carga el reporte JSON de ZAP");

    let report: unknown;
    try {
      report = JSON.parse(reportText);
    } catch {
      return setError("El reporte no es JSON válido");
    }

    setSaving(true);
    try {
      await onSubmit({
        projectId,
        name: name.trim(),
        targetUrl: targetUrl.trim(),
        environment: environment === "" ? undefined : environment,
        report,
      });
      reset();
      onClose();
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.issues.length > 0) {
        setError(requestError.issues.map((issue) => `${issue.path}: ${issue.message}`).join(" · "));
      } else {
        setError(requestError instanceof Error ? requestError.message : "Error al importar");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Importar reporte de evaluación"
      onClose={handleClose}
      wide
      footer={
        <>
          <Button variant="quiet" onClick={handleClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} loading={saving}>
            Importar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-lg border border-line bg-hull/50 px-3 py-2 text-xs leading-relaxed text-sky/50">
          Importa el reporte JSON de OWASP ZAP (Automation Framework o reporte tradicional). StressLab
          normaliza las alertas y las guarda como hallazgos <strong className="text-sky/80">pendientes de revisión</strong>.
          Esta función no ejecuta escaneos.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Proyecto"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
          />
          <SelectField
            label="Entorno (opcional)"
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as ProjectEnvironment | "")}
            options={[{ value: "", label: "Heredar del proyecto" }, ...ENVIRONMENTS]}
          />
          <TextField
            label="Nombre de la evaluación"
            placeholder="Escaneo ZAP — 18 nov 2026"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="URL del objetivo"
            placeholder="https://api.ejemplo.com"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            hint="Debe estar dentro del alcance del proyecto"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => fileInput.current?.click()}>
            Cargar archivo .json
          </Button>
          {fileName ? <span className="truncate font-mono text-xs text-mint">{fileName}</span> : null}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-sky/60">Reporte JSON</span>
          <textarea
            value={reportText}
            onChange={(event) => {
              setReportText(event.target.value);
              setFileName(null);
            }}
            rows={10}
            placeholder='{"site":[{"name":"https://…","alerts":[…]}]}'
            className="w-full rounded-lg border border-line bg-hull/70 px-3 py-2 font-mono text-xs leading-relaxed text-sky/90 placeholder:text-sky/30 focus:border-cyan-glow/50 focus:outline-none"
          />
          <span className="text-xs text-sky/40">Máximo 8 MB · se valida el formato antes de guardar</span>
        </label>

        {error ? (
          <div className="rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-xs text-rose">{error}</div>
        ) : null}
      </div>
    </Modal>
  );
}
