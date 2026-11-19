import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/http-error.js";
import { projectRepository } from "../models/project.repository.js";
import {
  assessmentImportSchema,
  findingReviewSchema,
} from "../models/security.schema.js";
import type { Project, SecurityAssessment } from "../models/types.js";
import {
  normalizeZapReport,
  reportFingerprint,
  scopeKeyFor,
} from "../services/security/normalizer.js";
import { securityRepository } from "../services/security/repository.js";
import {
  aiAvailable,
  analyzeAssessment,
  analyzeFinding,
} from "../services/ai/bedrock.service.js";
import { buildSecurityReportPdf } from "../services/security/report.service.js";

const listQuerySchema = z.object({
  projectId: z.string().min(1).max(60).optional(),
});

const compareQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

function parseBoolean(value: unknown): boolean {
  return value === "true" || value === "1";
}

export async function listAssessments(request: Request, response: Response): Promise<void> {
  const query = listQuerySchema.parse(request.query);
  const assessments = await securityRepository.listAssessments(query.projectId);
  response.json({ assessments, aiAvailable: aiAvailable() });
}

export async function getAssessment(request: Request, response: Response): Promise<void> {
  const assessment = await securityRepository.getAssessment(String(request.params.id));
  if (!assessment) throw new HttpError(404, "Evaluación no encontrada");
  const findings = await securityRepository.listFindings(assessment.id);
  response.json({ assessment, findings });
}

export async function importAssessment(request: Request, response: Response): Promise<void> {
  const input = assessmentImportSchema.parse(request.body);

  const project = await projectRepository.get(input.projectId);
  if (!project) throw new HttpError(404, "Proyecto no encontrado");

  assertScopeAllows(project, input.targetUrl);

  const fingerprint = reportFingerprint(input.report);
  const duplicate = await securityRepository.findByFingerprint(project.id, fingerprint);
  if (duplicate) {
    throw new HttpError(409, `Este reporte ya fue importado como «${duplicate.name}»`);
  }

  const findings = normalizeZapReport(input.report);
  const environment = input.environment ?? project.environment;

  const assessment = await securityRepository.createAssessment(
    {
      id: crypto.randomUUID(),
      projectId: project.id,
      name: input.name,
      source: "owasp-zap",
      targetUrl: input.targetUrl,
      environment,
      scopeKey: scopeKeyFor(input.targetUrl, environment),
      status: "imported",
      findingCount: findings.length,
      severitySummary: emptySummary(),
      reportFingerprint: fingerprint,
      createdAt: new Date().toISOString(),
    },
    findings,
  );

  response.status(201).json(assessment);
}

export async function reviewFinding(request: Request, response: Response): Promise<void> {
  const input = findingReviewSchema.parse(request.body);
  if (input.status === undefined && input.reviewNote === undefined) {
    throw new HttpError(400, "Indica status o reviewNote");
  }

  const finding = await securityRepository.getFinding(String(request.params.id));
  if (!finding) throw new HttpError(404, "Hallazgo no encontrado");

  const updated = await securityRepository.updateFinding(finding.id, input);
  response.json(updated);
}

export async function analyzeAssessmentHandler(request: Request, response: Response): Promise<void> {
  const assessment = await securityRepository.getAssessment(String(request.params.id));
  if (!assessment) throw new HttpError(404, "Evaluación no encontrada");

  const project = await projectRepository.get(assessment.projectId);
  const findings = await securityRepository.listFindings(assessment.id);

  if (findings.length === 0) {
    throw new HttpError(400, "La evaluación no tiene hallazgos para analizar");
  }

  await securityRepository.setAssessmentStatus(assessment.id, "analyzing");

  try {
    const perFinding = await Promise.all(
      findings.slice(0, 60).map(async (finding) => {
        const analysis = await analyzeFinding(finding, project, assessment);
        await securityRepository.saveFindingAiAnalysis(finding.id, analysis);
        return finding.id;
      }),
    );

    const refreshed = await securityRepository.listFindings(assessment.id);
    const analyzedFindings = refreshed.filter((finding) => perFinding.includes(finding.id));
    const summary = await analyzeAssessment(assessment, analyzedFindings, project);

    await securityRepository.saveAiAnalysis(assessment.id, summary);
    const updated = await securityRepository.getAssessment(assessment.id);
    response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    await securityRepository.setAssessmentStatus(assessment.id, "failed", {
      aiError: message,
      analyzedAt: new Date().toISOString(),
    });
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, `Fallo al analizar con IA: ${message}`);
  }
}

export async function compareAssessments(request: Request, response: Response): Promise<void> {
  const query = compareQuerySchema.parse(request.query);
  const comparison = await securityRepository.compare(query.from, query.to);
  if (!comparison) throw new HttpError(404, "No se encontraron ambas evaluaciones");
  response.json(comparison);
}

export async function downloadSecurityReport(request: Request, response: Response): Promise<void> {
  const assessment = await securityRepository.getAssessment(String(request.params.id));
  if (!assessment) throw new HttpError(404, "Evaluación no encontrada");

  const project = await projectRepository.get(assessment.projectId);
  const findings = await securityRepository.listFindings(assessment.id);
  const withRun = parseBoolean(request.query.withRun);

  const runContext = withRun ? await loadComparableRun(assessment, project) : null;

  const pdf = await buildSecurityReportPdf({ assessment, findings, project, run: runContext });
  const filename = `stresslab-seguridad-${assessment.id.slice(0, 8)}.pdf`;
  response
    .status(200)
    .setHeader("Content-Type", "application/pdf")
    .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    .send(pdf);
}

async function loadComparableRun(
  assessment: SecurityAssessment,
  project: Project | null,
): Promise<{ scenarioName: string; summary: Record<string, unknown> | null; startedAt: string } | null> {
  if (!project) return null;
  const { runRepository } = await import("../models/run.repository.js");
  const runs = await runRepository.list(100);
  const candidate = runs.find(
    (run) => run.projectId === project.id && run.status === "completed" && run.summary !== null,
  );
  if (!candidate) return null;
  return {
    scenarioName: candidate.scenarioName,
    summary: (candidate.summary as Record<string, unknown> | null) ?? null,
    startedAt: candidate.startedAt,
  };
}

function assertScopeAllows(project: Project, targetUrl: string): void {
  if (project.scope.length === 0) return;

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new HttpError(400, "La URL del objetivo no es válida");
  }

  const origin = `${parsed.protocol}//${parsed.host}`;
  const allowed = project.scope.some((entry) => {
    try {
      const scopeUrl = new URL(entry);
      return `${scopeUrl.protocol}//${scopeUrl.host}` === origin;
    } catch {
      return entry === origin || entry === targetUrl;
    }
  });

  if (!allowed) {
    throw new HttpError(
      403,
      `El objetivo ${origin} está fuera del alcance declarado del proyecto`,
    );
  }
}

function emptySummary(): Record<string, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}
