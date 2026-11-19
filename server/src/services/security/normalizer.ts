import { createHash } from "node:crypto";
import type { FindingSeverity } from "../../models/types.js";
import type { ZapReport } from "../../models/security.schema.js";

export interface NormalizedFinding {
  fingerprint: string;
  ruleId: string;
  title: string;
  severity: FindingSeverity;
  scannerConfidence: number | null;
  method: string | null;
  url: string | null;
  parameter: string | null;
  evidence: string | null;
  scannerSolution: string | null;
  reference: string | null;
}

function severityFromRisk(riskcode: unknown, risk: unknown): FindingSeverity {
  const raw = typeof riskcode === "number" ? String(riskcode) : (riskcode ?? "").toString().trim();
  const label = typeof risk === "string" ? risk.trim().toLowerCase() : "";

  if (raw === "3" || label.includes("high")) return "high";
  if (raw === "2" || label.includes("medium") || label.includes("med")) return "medium";
  if (raw === "1" || label.includes("low")) return "low";
  if (label.includes("critical")) return "critical";
  return "info";
}

function confidenceValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed > 4) return 4;
  if (parsed < 0) return 0;
  return parsed;
}

function confidenceRatio(value: unknown): number | null {
  const parsed = confidenceValue(value);
  if (parsed === null) return null;
  return parsed / 4;
}

function hash(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function cleanUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 1900 ? value.slice(0, 1900) : value;
}

interface RawAlert {
  pluginid?: string | number;
  alert?: string;
  name?: string;
  riskcode?: string | number;
  risk?: string;
  confidence?: string | number;
  solution?: string;
  reference?: string;
  instances?: Array<{
    uri?: string;
    method?: string;
    param?: string;
    evidence?: string;
    otherinfo?: string;
  }>;
}

function normalizeAlert(alert: RawAlert): NormalizedFinding[] {
  const ruleId = String(alert.pluginid ?? "").trim() || "sin-regla";
  const title = (alert.alert ?? alert.name ?? "Hallazgo sin nombre").trim().slice(0, 300);
  const severity = severityFromRisk(alert.riskcode, alert.risk);
  const scannerConfidence = confidenceRatio(alert.confidence);
  const solution = alert.solution?.trim() ? alert.solution.trim().slice(0, 20_000) : null;
  const reference = alert.reference?.trim() ? alert.reference.trim().slice(0, 4000) : null;
  const instances = alert.instances && alert.instances.length > 0 ? alert.instances : [undefined];

  return instances.map((instance) => {
    const url = cleanUrl(instance?.uri);
    const method = instance?.method?.trim().toUpperCase().slice(0, 10) || null;
    const parameter = instance?.param?.trim().slice(0, 300) || null;
    const evidenceParts = [instance?.evidence, instance?.otherinfo]
      .map((part) => (part ?? "").trim())
      .filter((part) => part.length > 0);
    const evidence = evidenceParts.length > 0 ? evidenceParts.join("\n").slice(0, 8000) : null;

    const fingerprint = hash(["zap", ruleId, title, method ?? "", url ?? "", parameter ?? ""]);

    return {
      fingerprint,
      ruleId,
      title,
      severity,
      scannerConfidence,
      method,
      url,
      parameter,
      evidence,
      scannerSolution: solution,
      reference,
    };
  });
}

export function normalizeZapReport(report: ZapReport): NormalizedFinding[] {
  const alerts: RawAlert[] = [];

  if (Array.isArray(report.site)) {
    for (const site of report.site) {
      if (Array.isArray(site.alerts)) alerts.push(...site.alerts);
    }
  }
  if (Array.isArray(report.alerts)) alerts.push(...report.alerts);

  const findings = alerts.flatMap(normalizeAlert);
  const seen = new Set<string>();
  const deduped: NormalizedFinding[] = [];

  for (const finding of findings) {
    if (seen.has(finding.fingerprint)) continue;
    seen.add(finding.fingerprint);
    deduped.push(finding);
  }

  return deduped;
}

export function reportFingerprint(report: ZapReport): string {
  return hash([JSON.stringify(report)]);
}

export function scopeKeyFor(targetUrl: string, environment: string): string {
  try {
    const parsed = new URL(targetUrl);
    return `${environment}|${parsed.protocol}//${parsed.host}`;
  } catch {
    return `${environment}|${targetUrl}`;
  }
}
