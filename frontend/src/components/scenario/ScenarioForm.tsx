import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import type { LoadMode, Scenario, ScenarioInput, ScenarioType } from "../../lib/types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import {
  SegmentedControl,
  TextAreaField,
  TextField,
  Toggle,
} from "../ui/Field";

interface HeaderPair {
  key: string;
  value: string;
}

interface FormState {
  name: string;
  type: ScenarioType;
  url: string;
  method: string;
  headers: HeaderPair[];
  body: string;
  loadMode: LoadMode;
  stages: Array<{ duration: string; target: string }>;
  arrivalRate: string;
  duration: string;
  preAllocatedVUs: string;
  maxVUs: string;
  thinkTime: string;
  followRedirects: boolean;
  insecureTls: boolean;
  expectedStatus: string;
  p95Ms: string;
  p99Ms: string;
  maxErrorRate: string;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

function emptyForm(): FormState {
  return {
    name: "",
    type: "api",
    url: "",
    method: "GET",
    headers: [],
    body: "",
    loadMode: "ramping-vus",
    stages: [
      { duration: "20s", target: "10" },
      { duration: "30s", target: "10" },
      { duration: "20s", target: "0" },
    ],
    arrivalRate: "10",
    duration: "1m",
    preAllocatedVUs: "50",
    maxVUs: "200",
    thinkTime: "0",
    followRedirects: true,
    insecureTls: false,
    expectedStatus: "200",
    p95Ms: "",
    p99Ms: "",
    maxErrorRate: "",
  };
}

function toFormState(scenario: Scenario): FormState {
  return {
    name: scenario.name,
    type: scenario.type,
    url: scenario.url,
    method: scenario.method,
    headers: Object.entries(scenario.headers).map(([key, value]) => ({ key, value })),
    body: scenario.body ?? "",
    loadMode: scenario.loadMode,
    stages: scenario.stages.map((stage) => ({ duration: stage.duration, target: String(stage.target) })),
    arrivalRate: scenario.arrivalRate ? String(scenario.arrivalRate) : "10",
    duration: scenario.duration ?? "1m",
    preAllocatedVUs: String(scenario.preAllocatedVUs),
    maxVUs: String(scenario.maxVUs),
    thinkTime: String(scenario.thinkTime),
    followRedirects: scenario.followRedirects,
    insecureTls: scenario.insecureTls,
    expectedStatus: String(scenario.expectedStatus),
    p95Ms: scenario.thresholds.p95Ms ? String(scenario.thresholds.p95Ms) : "",
    p99Ms: scenario.thresholds.p99Ms ? String(scenario.thresholds.p99Ms) : "",
    maxErrorRate:
      scenario.thresholds.maxErrorRate !== null && scenario.thresholds.maxErrorRate !== undefined
        ? String(scenario.thresholds.maxErrorRate)
        : "",
  };
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = "Ponle un nombre al escenario";
  if (!/^https?:\/\/.+/i.test(form.url.trim())) errors.url = "URL http(s) requerida (pública o privada)";
  if (form.loadMode === "constant-arrival-rate") {
    const rate = Number(form.arrivalRate);
    if (!Number.isFinite(rate) || rate < 1) errors.arrivalRate = "Peticiones por segundo inválidas";
    if (!/^\d+[smh]$/.test(form.duration.trim())) errors.duration = "Duración inválida (ej: 1m, 30s)";
  } else {
    if (form.stages.length === 0) errors.stages = "Agrega al menos una etapa";
    for (const [index, stage] of form.stages.entries()) {
      if (!/^\d+[smh]$/.test(stage.duration.trim())) {
        errors.stages = `Etapa ${index + 1}: duración inválida (ej: 30s)`;
        break;
      }
      if (!Number.isFinite(Number(stage.target)) || Number(stage.target) < 0) {
        errors.stages = `Etapa ${index + 1}: usuarios inválidos`;
        break;
      }
    }
  }
  if (!/^\d{3}$/.test(form.expectedStatus.trim())) errors.expectedStatus = "Código HTTP de 3 dígitos";
  return errors;
}

function toInput(form: FormState): ScenarioInput {
  const headers = Object.fromEntries(
    form.headers
      .filter((pair) => pair.key.trim().length > 0)
      .map((pair) => [pair.key.trim(), pair.value]),
  );
  const bodyAllowed = form.method !== "GET" && form.method !== "HEAD";

  return {
    name: form.name.trim(),
    type: form.type,
    url: form.url.trim(),
    method: form.method,
    headers,
    body: bodyAllowed && form.body.trim() ? form.body : null,
    loadMode: form.loadMode,
    stages:
      form.loadMode === "ramping-vus"
        ? form.stages.map((stage) => ({ duration: stage.duration.trim(), target: Number(stage.target) || 0 }))
        : [{ duration: form.duration.trim(), target: 0 }],
    arrivalRate: form.loadMode === "constant-arrival-rate" ? Number(form.arrivalRate) : null,
    duration: form.loadMode === "constant-arrival-rate" ? form.duration.trim() : null,
    preAllocatedVUs: Number(form.preAllocatedVUs) || 50,
    maxVUs: Number(form.maxVUs) || 200,
    thinkTime: Number(form.thinkTime) || 0,
    followRedirects: form.followRedirects,
    insecureTls: form.insecureTls,
    expectedStatus: Number(form.expectedStatus) || 200,
    thresholds: {
      p95Ms: form.p95Ms.trim() ? Number(form.p95Ms) : null,
      p99Ms: form.p99Ms.trim() ? Number(form.p99Ms) : null,
      maxErrorRate: form.maxErrorRate.trim() ? Number(form.maxErrorRate) : null,
    },
  };
}

interface ScenarioFormProps {
  open: boolean;
  initial: Scenario | null;
  onClose: () => void;
  onSubmit: (input: ScenarioInput) => Promise<void>;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="col-span-full border-b border-line pb-2 text-xs font-semibold tracking-[0.18em] text-cyan-glow/80 uppercase">
      {children}
    </h3>
  );
}

export function ScenarioForm({ open, initial, onClose, onSubmit }: ScenarioFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverIssues, setServerIssues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? toFormState(initial) : emptyForm());
    setErrors({});
    setServerIssues([]);
  }, [open, initial]);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key as string]) return previous;
      const next = { ...previous };
      delete next[key as string];
      return next;
    });
  };

  const bodyVisible = useMemo(() => form.method !== "GET" && form.method !== "HEAD", [form.method]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setServerIssues([]);
    const clientErrors = validate(form);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      await onSubmit(toInput(form));
      onClose();
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        setServerIssues(
          requestError.issues.length > 0
            ? requestError.issues.map((issue) => `${issue.path || "formulario"}: ${issue.message}`)
            : [requestError.message],
        );
      } else {
        setServerIssues([requestError instanceof Error ? requestError.message : "Error inesperado"]);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? "Editar escenario" : "Nuevo escenario"}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {initial ? "Guardar cambios" : "Crear escenario"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <SectionTitle>Objetivo</SectionTitle>

        <TextField
          label="Nombre"
          placeholder="API — Usuarios (producción)"
          value={form.name}
          onChange={(event) => patch("name", event.target.value)}
          error={errors.name}
          containerClassName="sm:col-span-2"
          required
        />

        <div className="sm:col-span-2">
          <SegmentedControl
            label="Tipo de objetivo"
            value={form.type}
            onChange={(value) => patch("type", value)}
            options={[
              { value: "api", label: "API" },
              { value: "web", label: "Página web" },
            ]}
          />
        </div>

        <TextField
          label="URL del destino"
          placeholder="https://api.interna.local/v1/pedidos"
          value={form.url}
          onChange={(event) => patch("url", event.target.value)}
          error={errors.url}
          hint="Puede ser una URL pública o de tu red privada"
          containerClassName="sm:col-span-2"
          required
        />

        <TextField
          label="Método"
          value={form.method}
          onChange={(event) => patch("method", event.target.value.toUpperCase())}
          list="http-methods"
          error={errors.method}
        />
        <datalist id="http-methods">
          {METHODS.map((method) => (
            <option key={method} value={method} />
          ))}
        </datalist>

        <TextField
          label="Status esperado"
          inputMode="numeric"
          value={form.expectedStatus}
          onChange={(event) => patch("expectedStatus", event.target.value)}
          error={errors.expectedStatus}
        />

        <SectionTitle>Modelo de carga</SectionTitle>

        <div className="sm:col-span-2">
          <SegmentedControl
            label="Ejecutor"
            value={form.loadMode}
            onChange={(value) => patch("loadMode", value)}
            options={[
              { value: "ramping-vus", label: "Rampa de usuarios" },
              { value: "constant-arrival-rate", label: "Tasa constante (req/s)" },
            ]}
          />
        </div>

        {form.loadMode === "ramping-vus" ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-xs font-medium tracking-wide text-sky/60">Etapas (duración → usuarios)</span>
            {form.stages.map((stage, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  aria-label={`Duración etapa ${index + 1}`}
                  value={stage.duration}
                  onChange={(event) =>
                    patch(
                      "stages",
                      form.stages.map((item, i) => (i === index ? { ...item, duration: event.target.value } : item)),
                    )
                  }
                  className="w-28 rounded-lg border border-line bg-hull/70 px-3 py-2 font-mono text-sm text-sky/90 focus:border-cyan-glow/50 focus:outline-none"
                  placeholder="30s"
                />
                <span className="text-sky/40">→</span>
                <input
                  aria-label={`Usuarios etapa ${index + 1}`}
                  inputMode="numeric"
                  value={stage.target}
                  onChange={(event) =>
                    patch(
                      "stages",
                      form.stages.map((item, i) => (i === index ? { ...item, target: event.target.value } : item)),
                    )
                  }
                  className="w-24 rounded-lg border border-line bg-hull/70 px-3 py-2 font-mono text-sm text-sky/90 focus:border-cyan-glow/50 focus:outline-none"
                  placeholder="25"
                />
                <button
                  type="button"
                  aria-label={`Eliminar etapa ${index + 1}`}
                  onClick={() => patch("stages", form.stages.filter((_, i) => i !== index))}
                  className="rounded-lg border border-line px-2.5 py-2 text-xs text-sky/50 transition-colors hover:border-rose/40 hover:text-rose"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => patch("stages", [...form.stages, { duration: "30s", target: "50" }])}
                className="px-3 py-1.5 text-xs"
              >
                + Etapa
              </Button>
              {errors.stages ? <span className="text-xs text-rose">{errors.stages}</span> : null}
            </div>
          </div>
        ) : (
          <>
            <TextField
              label="Peticiones por segundo"
              inputMode="numeric"
              value={form.arrivalRate}
              onChange={(event) => patch("arrivalRate", event.target.value)}
              error={errors.arrivalRate}
            />
            <TextField
              label="Duración total"
              value={form.duration}
              onChange={(event) => patch("duration", event.target.value)}
              error={errors.duration}
              hint="Ej: 30s, 2m, 1h"
            />
          </>
        )}

        <TextField
          label="Think time (s)"
          inputMode="decimal"
          value={form.thinkTime}
          onChange={(event) => patch("thinkTime", event.target.value)}
          hint="Pausa entre peticiones por VU"
        />
        <div className="hidden sm:block" />

        <TextField
          label="VUs preasignados"
          inputMode="numeric"
          value={form.preAllocatedVUs}
          onChange={(event) => patch("preAllocatedVUs", event.target.value)}
        />
        <TextField
          label="VUs máximos"
          inputMode="numeric"
          value={form.maxVUs}
          onChange={(event) => patch("maxVUs", event.target.value)}
        />

        <SectionTitle>Peticiones</SectionTitle>

        <div className="sm:col-span-2">
          <TextAreaField
            label={bodyVisible ? "Body (JSON o texto)" : "Body — no aplica con GET/HEAD"}
            rows={bodyVisible ? 4 : 2}
            value={form.body}
            onChange={(event) => patch("body", event.target.value)}
            placeholder='{"nombre":"pedido"}'
            disabled={!bodyVisible}
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium tracking-wide text-sky/60">Headers</span>
          {form.headers.map((pair, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                aria-label={`Header ${index + 1} nombre`}
                value={pair.key}
                onChange={(event) =>
                  patch(
                    "headers",
                    form.headers.map((item, i) => (i === index ? { ...item, key: event.target.value } : item)),
                  )
                }
                placeholder="Authorization"
                className="w-1/2 rounded-lg border border-line bg-hull/70 px-3 py-2 font-mono text-xs text-sky/90 placeholder:text-sky/30 focus:border-cyan-glow/50 focus:outline-none"
              />
              <input
                aria-label={`Header ${index + 1} valor`}
                value={pair.value}
                onChange={(event) =>
                  patch(
                    "headers",
                    form.headers.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)),
                  )
                }
                placeholder="Bearer token..."
                className="w-1/2 rounded-lg border border-line bg-hull/70 px-3 py-2 font-mono text-xs text-sky/90 placeholder:text-sky/30 focus:border-cyan-glow/50 focus:outline-none"
              />
              <button
                type="button"
                aria-label={`Eliminar header ${index + 1}`}
                onClick={() => patch("headers", form.headers.filter((_, i) => i !== index))}
                className="rounded-lg border border-line px-2.5 py-2 text-xs text-sky/50 transition-colors hover:border-rose/40 hover:text-rose"
              >
                ✕
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() => patch("headers", [...form.headers, { key: "", value: "" }])}
            className="self-start px-3 py-1.5 text-xs"
          >
            + Header
          </Button>
        </div>

        <SectionTitle>Umbrales y seguridad</SectionTitle>

        <TextField
          label="p95 máximo (ms)"
          inputMode="numeric"
          value={form.p95Ms}
          onChange={(event) => patch("p95Ms", event.target.value)}
          hint="Vacío = sin umbral"
        />
        <TextField
          label="p99 máximo (ms)"
          inputMode="numeric"
          value={form.p99Ms}
          onChange={(event) => patch("p99Ms", event.target.value)}
        />
        <TextField
          label="Error máximo (0–1)"
          inputMode="decimal"
          value={form.maxErrorRate}
          onChange={(event) => patch("maxErrorRate", event.target.value)}
          hint="Ej: 0.01 = 1%"
        />
        <div className="hidden sm:block" />

        <div className="flex flex-col gap-4 sm:col-span-2">
          <Toggle
            label="Seguir redirecciones"
            checked={form.followRedirects}
            onChange={(checked) => patch("followRedirects", checked)}
          />
          <Toggle
            label="Ignorar certificados TLS no válidos"
            hint="Útil en entornos internos con certificados autofirmados"
            checked={form.insecureTls}
            onChange={(checked) => patch("insecureTls", checked)}
          />
        </div>

        {serverIssues.length > 0 ? (
          <div className="rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-xs text-rose sm:col-span-2">
            {serverIssues.map((issue) => (
              <p key={issue}>• {issue}</p>
            ))}
          </div>
        ) : null}

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
