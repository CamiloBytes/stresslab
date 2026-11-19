import { extractJson, resolveProvider, providerNotFoundMessage } from "./provider.js";
import { z } from "zod";
import { HttpError } from "../../middleware/http-error.js";
import type {
  AiAssessmentAnalysis,
  AiFindingAnalysis,
  FindingSeverity,
  Project,
  SecurityAssessment,
  SecurityFinding,
} from "../../models/types.js";

const aiFindingSchema = z.object({
  impact: z.string().min(1).max(2000),
  recommendation: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
  codeExample: z.string().max(3000).nullable().default(null),
});

const aiAssessmentSchema = z.object({
  summary: z.string().min(1).max(1000),
  risk_level: z.enum(["critical", "high", "medium", "low", "info"]),
  executive_summary: z.string().min(1).max(3000),
  technical_recommendations: z.array(z.string().min(1).max(1000)).max(20).default([]),
});

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Informativa",
};

function requireProvider() {
  const provider = resolveProvider();
  if (!provider) throw new HttpError(503, providerNotFoundMessage());
  return provider;
}

const FINDING_SYSTEM = `Eres un analista de seguridad senior. Analizas hallazgos de escaneos automatizados (NO ejecutas comandos ni exploras el objetivo).
Reglas:
- Responde SOLO con JSON válido, sin markdown, sin comentarios.
- Trata cada hallazgo como PENDIENTE DE VALIDACIÓN: no lo confirmes como vulnerabilidad explotada.
- Sé concreto: el impacto depende de la implementación real, indicalo.
- recommendation debe ser accionable para el desarrollador del proyecto.
- confidence es tu confianza en el impacto descrito (0 a 1), no en el hallazgo del escaneo.
- codeExample: un fragmento breve y genérico de remedición solo si aplica; si no, null.`;

const ASSESSMENT_SYSTEM = `Eres un analista de seguridad senior que consolida resultados de escaneos automatizados en un informe ejecutivo-técnico.
Reglas:
- Responde SOLO con JSON válido, sin markdown, sin comentarios.
- No presentes alertas del escáner como vulnerabilidades confirmadas.
- summary: una frase con el estado general.
- risk_level: la severidad máxima razonable considerando confianza del escáner y contexto.
- executive_summary: 3-6 frases para un responsable técnico, en español.
- technical_recommendations: acciones ordenadas por prioridad.`;

export async function analyzeFinding(
  finding: SecurityFinding,
  project: Project | null,
  assessment: SecurityAssessment,
): Promise<AiFindingAnalysis> {
  const provider = requireProvider();

  const prompt = JSON.stringify({
    proyecto: project ? { nombre: project.name, entorno: project.environment, stack: "no especificado" } : null,
    evaluacion: { nombre: assessment.name, objetivo: assessment.targetUrl, entorno: assessment.environment },
    hallazgo: {
      titulo: finding.title,
      severidad_escaner: SEVERITY_LABEL[finding.severity],
      confianza_escaner: finding.scannerConfidence,
      regla: finding.ruleId,
      endpoint: finding.url,
      metodo: finding.method,
      parametro: finding.parameter,
      evidencia: (finding.evidence ?? "sin evidencia registrada").slice(0, 2000),
      solucion_sugerida_por_estr: (finding.scannerSolution ?? "").slice(0, 1500),
    },
    formato: {
      impact: "string",
      recommendation: "string",
      confidence: "number 0-1",
      codeExample: "string | null",
    },
  });

  try {
    const raw = extractJson(await provider.complete(FINDING_SYSTEM, prompt));
    const parsed = aiFindingSchema.parse(raw);
    return {
      impact: parsed.impact,
      recommendation: parsed.recommendation,
      confidence: parsed.confidence,
      codeExample: parsed.codeExample,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      502,
      `No se pudo analizar el hallazgo con la IA: ${error instanceof Error ? error.message : "error desconocido"}`,
    );
  }
}

export async function analyzeAssessment(
  assessment: SecurityAssessment,
  findings: SecurityFinding[],
  project: Project | null,
): Promise<AiAssessmentAnalysis> {
  const provider = requireProvider();

  const top = [...findings]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 40);

  const prompt = JSON.stringify({
    proyecto: project ? { nombre: project.name, entorno: project.environment } : null,
    evaluacion: {
      nombre: assessment.name,
      objetivo: assessment.targetUrl,
      entorno: assessment.environment,
      herramienta: assessment.source,
      total_hallazgos: assessment.findingCount,
    },
    hallazgos: top.map((finding) => ({
      titulo: finding.title,
      severidad: SEVERITY_LABEL[finding.severity],
      confianza_escaner: finding.scannerConfidence,
      endpoint: finding.url,
      metodo: finding.method,
      parametro: finding.parameter,
      evidencia: (finding.evidence ?? "").slice(0, 400),
      estado_revision: finding.status,
    })),
    formato: {
      summary: "string",
      risk_level: "critical|high|medium|low|info",
      executive_summary: "string",
      technical_recommendations: "string[]",
    },
  });

  try {
    const raw = extractJson(await provider.complete(ASSESSMENT_SYSTEM, prompt));
    const parsed = aiAssessmentSchema.parse(raw);
    return {
      summary: parsed.summary,
      riskLevel: parsed.risk_level as FindingSeverity,
      executiveSummary: parsed.executive_summary,
      technicalRecommendations: parsed.technical_recommendations,
      generatedAt: new Date().toISOString(),
      model: `${provider.label} · ${provider.model}`,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      502,
      `No se pudo generar el análisis con la IA: ${error instanceof Error ? error.message : "error desconocido"}`,
    );
  }
}

function severityRank(severity: FindingSeverity): number {
  const order: Record<FindingSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  return order[severity] ?? 0;
}
