import { db } from "../../config/db.js";
import type {
  AssessmentComparison,
  ComparisonFinding,
  FindingSeverity,
  FindingStatus,
  SecurityAssessment,
  SecurityFinding,
  AiAssessmentAnalysis,
  AiFindingAnalysis,
} from "../../models/types.js";
import type { NormalizedFinding } from "./normalizer.js";

interface AssessmentRow {
  responseContract: string | null;
  id: string;
  projectId: string;
  name: string;
  source: string;
  targetUrl: string;
  environment: string;
  scopeKey: string;
  reportFingerprint: string;
  status: string;
  findingCount: number;
  severitySummary: string | null;
  aiAnalysis: string | null;
  aiError: string | null;
  createdAt: string;
  analyzedAt: string | null;
}

interface FindingRow {
  id: string;
  assessmentId: string;
  fingerprint: string;
  ruleId: string;
  title: string;
  severity: string;
  scannerConfidence: number | null;
  method: string | null;
  url: string | null;
  parameter: string | null;
  evidence: string | null;
  scannerSolution: string | null;
  reference: string | null;
  status: string;
  reviewNote: string | null;
  aiAnalysis: string | null;
  createdAt: string;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const EMPTY_SUMMARY: Record<FindingSeverity, number> = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0,
};

function toAssessment(row: AssessmentRow): SecurityAssessment {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    source: row.source,
    targetUrl: row.targetUrl,
    environment: row.environment,
    scopeKey: row.scopeKey,
    responseContract: parseJson(row.responseContract,null),
    status: row.status as SecurityAssessment["status"],
    findingCount: row.findingCount,
    severitySummary: parseJson<Record<FindingSeverity, number>>(row.severitySummary, { ...EMPTY_SUMMARY }),
    aiAnalysis: parseJson<AiAssessmentAnalysis | null>(row.aiAnalysis, null),
    aiError: row.aiError,
    createdAt: row.createdAt,
    analyzedAt: row.analyzedAt,
  };
}

function toFinding(row: FindingRow): SecurityFinding {
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    fingerprint: row.fingerprint,
    ruleId: row.ruleId,
    title: row.title,
    severity: row.severity as FindingSeverity,
    scannerConfidence: row.scannerConfidence,
    method: row.method,
    url: row.url,
    parameter: row.parameter,
    evidence: row.evidence,
    scannerSolution: row.scannerSolution,
    reference: row.reference,
    status: row.status as FindingStatus,
    reviewNote: row.reviewNote,
    aiAnalysis: parseJson<AiFindingAnalysis | null>(row.aiAnalysis, null),
    createdAt: row.createdAt,
  };
}

export class SecurityRepository {
  async saveAnalysisBatch(findings: Pick<SecurityFinding,'id'|'aiAnalysis'>[]):Promise<void> {
    await db.transaction(async trx=>{
      for(const finding of findings) await trx('security_findings').where({id:finding.id}).update({aiAnalysis:JSON.stringify(finding.aiAnalysis)});
    });
  }
  async findByFingerprint(projectId: string, reportFingerprint: string): Promise<SecurityAssessment | null> {
    const row = await db<AssessmentRow>("security_assessments")
      .where({ projectId, reportFingerprint })
      .first();
    return row ? toAssessment(row) : null;
  }

  async listAssessments(projectId?: string): Promise<SecurityAssessment[]> {
    const query = db<AssessmentRow>("security_assessments");
    if (projectId) query.where({ projectId });
    const rows = await query.orderBy("createdAt", "desc").limit(200);
    return rows.map(toAssessment);
  }

  async getAssessment(id: string): Promise<SecurityAssessment | null> {
    const row = await db<AssessmentRow>("security_assessments").where({ id }).first();
    return row ? toAssessment(row) : null;
  }

  async createAssessment(
    input: Omit<SecurityAssessment, "aiAnalysis" | "aiError" | "analyzedAt"> & {
      reportFingerprint: string;
    },
    findings: NormalizedFinding[],
  ): Promise<SecurityAssessment> {
    const now = new Date().toISOString();
    const severitySummary = { ...EMPTY_SUMMARY };
    for (const finding of findings) severitySummary[finding.severity] += 1;

    const row = {
      id: input.id,
      projectId: input.projectId,
      name: input.name,
      source: input.source,
      targetUrl: input.targetUrl,
      environment: input.environment,
      scopeKey: input.scopeKey,
      reportFingerprint: input.reportFingerprint,
      responseContract: input.responseContract ? JSON.stringify(input.responseContract) : null,
      status: input.status,
      findingCount: findings.length,
      severitySummary: JSON.stringify(severitySummary),
      aiError: null,
      createdAt: now,
      analyzedAt: null,
    };

    await db("security_assessments").insert(row);

    if (findings.length > 0) {
      await db("security_findings").insert(
        findings.map((finding) => ({
          id: crypto.randomUUID(),
          assessmentId: input.id,
          fingerprint: finding.fingerprint,
          ruleId: finding.ruleId,
          title: finding.title,
          severity: finding.severity,
          scannerConfidence: finding.scannerConfidence,
          method: finding.method,
          url: finding.url,
          parameter: finding.parameter,
          evidence: finding.evidence,
          scannerSolution: finding.scannerSolution,
          reference: finding.reference,
          status: "pending",
          reviewNote: null,
          aiAnalysis: null,
          createdAt: now,
        })),
      );
    }

    return {
      id: input.id,
      projectId: input.projectId,
      name: input.name,
      source: input.source,
      targetUrl: input.targetUrl,
      environment: input.environment,
      scopeKey: input.scopeKey,
      status: input.status,
      findingCount: findings.length,
      severitySummary,
      responseContract: input.responseContract ?? null,
      aiAnalysis: null,
      aiError: null,
      createdAt: now,
      analyzedAt: null,
    };
  }

  async listFindings(assessmentId: string): Promise<SecurityFinding[]> {
    const rows = await db<FindingRow>("security_findings")
      .where({ assessmentId })
      .orderBy("createdAt", "asc")
      .limit(2000);
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return rows
      .map(toFinding)
      .sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));
  }

  async getFinding(id: string): Promise<SecurityFinding | null> {
    const row = await db<FindingRow>("security_findings").where({ id }).first();
    return row ? toFinding(row) : null;
  }

  async updateFinding(
    id: string,
    patch: { status?: FindingStatus; reviewNote?: string | null },
  ): Promise<SecurityFinding | null> {
    const existing = await this.getFinding(id);
    if (!existing) return null;
    await db("security_findings")
      .where({ id })
      .update({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.reviewNote !== undefined ? { reviewNote: patch.reviewNote } : {}),
      });
    return { ...existing, ...patch };
  }

  async setAssessmentStatus(
    id: string,
    status: SecurityAssessment["status"],
    extra: { aiError?: string | null; analyzedAt?: string | null } = {},
  ): Promise<void> {
    await db("security_assessments")
      .where({ id })
      .update({
        status,
        ...(extra.aiError !== undefined ? { aiError: extra.aiError } : {}),
        ...(extra.analyzedAt !== undefined ? { analyzedAt: extra.analyzedAt } : {}),
      });
  }

  async saveAiAnalysis(id: string, analysis: AiAssessmentAnalysis): Promise<void> {
    await db("security_assessments")
      .where({ id })
      .update({
        status: "analyzed",
        aiAnalysis: JSON.stringify(analysis),
        aiError: null,
        analyzedAt: analysis.generatedAt,
      });
  }

  async saveFindingAiAnalysis(id: string, analysis: AiFindingAnalysis | null): Promise<void> {
    await db("security_findings")
      .where({ id })
      .update({ aiAnalysis: analysis ? JSON.stringify(analysis) : null });
  }

  async compare(fromId: string, toId: string): Promise<AssessmentComparison | null> {
    const from = await this.getAssessment(fromId);
    const to = await this.getAssessment(toId);
    if (!from || !to) return null;

    const fromFindings = await this.listFindings(fromId);
    const toFindings = await this.listFindings(toId);

    const toByFingerprint = new Map(toFindings.map((finding) => [finding.fingerprint, finding]));
    const fromByFingerprint = new Map(fromFindings.map((finding) => [finding.fingerprint, finding]));

    const pick = (finding: SecurityFinding): ComparisonFinding => ({
      id: finding.id,
      fingerprint: finding.fingerprint,
      title: finding.title,
      severity: finding.severity,
      method: finding.method,
      url: finding.url,
      status: finding.status,
    });

    const persistent: ComparisonFinding[] = [];
    const newOnes: ComparisonFinding[] = [];
    const notObserved: ComparisonFinding[] = [];

    for (const finding of toFindings) {
      if (fromByFingerprint.has(finding.fingerprint)) persistent.push(pick(finding));
      else newOnes.push(pick(finding));
    }
    for (const finding of fromFindings) {
      if (!toByFingerprint.has(finding.fingerprint)) notObserved.push(pick(finding));
    }

    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const bySeverity = (a: ComparisonFinding, b: ComparisonFinding) =>
      (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9);

    return {
      from: { id: from.id, name: from.name, createdAt: from.createdAt },
      to: { id: to.id, name: to.name, createdAt: to.createdAt },
      persistent: persistent.sort(bySeverity),
      new: newOnes.sort(bySeverity),
      notObserved: notObserved.sort(bySeverity),
    };
  }
}

export const securityRepository = new SecurityRepository();
