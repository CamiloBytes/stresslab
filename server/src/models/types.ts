export type ScenarioType = "api" | "web";
export type LoadMode = "ramping-vus" | "constant-arrival-rate";
export type RunStatus = "running" | "completed" | "failed" | "stopped";

export interface ScenarioStage {
  duration: string;
  target: number;
}

export interface ScenarioThresholds {
  p95Ms: number | null;
  p99Ms: number | null;
  maxErrorRate: number | null;
}

export interface Scenario {
  id: string;
  name: string;
  type: ScenarioType;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  loadMode: LoadMode;
  stages: ScenarioStage[];
  arrivalRate: number | null;
  duration: string | null;
  preAllocatedVUs: number;
  maxVUs: number;
  thinkTime: number;
  followRedirects: boolean;
  insecureTls: boolean;
  expectedStatus: number;
  thresholds: ScenarioThresholds;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProjectEnvironment = "local" | "staging" | "production" | "other";

export interface Project {
  id: string;
  name: string;
  environment: ProjectEnvironment;
  scope: string[];
  createdAt: string;
  updatedAt: string;
}

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingStatus = "pending" | "confirmed" | "dismissed" | "remediated";
export type AssessmentStatus = "imported" | "analyzing" | "analyzed" | "failed";

export interface SecurityFinding {
  id: string;
  assessmentId: string;
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
  status: FindingStatus;
  reviewNote: string | null;
  aiAnalysis: AiFindingAnalysis | null;
  createdAt: string;
}

export interface AiFindingAnalysis {
  impact: string;
  recommendation: string;
  confidence: number;
  codeExample: string | null;
}

export interface AiAssessmentAnalysis {
  summary: string;
  riskLevel: FindingSeverity;
  executiveSummary: string;
  technicalRecommendations: string[];
  generatedAt: string;
  model: string;
}

export interface SecurityAssessment {
  id: string;
  projectId: string;
  name: string;
  source: string;
  targetUrl: string;
  environment: string;
  scopeKey: string;
  status: AssessmentStatus;
  findingCount: number;
  severitySummary: Record<FindingSeverity, number>;
  aiAnalysis: AiAssessmentAnalysis | null;
  aiError: string | null;
  createdAt: string;
  analyzedAt: string | null;
}

export interface AssessmentComparison {
  from: { id: string; name: string; createdAt: string };
  to: { id: string; name: string; createdAt: string };
  persistent: ComparisonFinding[];
  new: ComparisonFinding[];
  notObserved: ComparisonFinding[];
}

export interface ComparisonFinding {
  id: string;
  fingerprint: string;
  title: string;
  severity: FindingSeverity;
  method: string | null;
  url: string | null;
  status: FindingStatus;
}

export interface ThresholdResult {
  label: string;
  passed: boolean;
  actual: number;
  target: number;
}

export interface RunSummary {
  requests: number;
  errors: number;
  errorRate: number;
  avgLatencyMs: number;
  p95Ms: number;
  p99Ms: number;
  rps: number;
  iterations: number;
  checksRate: number;
  durationSec: number;
  thresholds: ThresholdResult[];
}

export interface Run {
  id: string;
  scenarioId: string;
  scenarioName: string;
  projectId: string | null;
  status: RunStatus;
  startedAt: string;
  endedAt: string | null;
  summary: RunSummary | null;
  error: string | null;
}

export interface LiveMetrics {
  elapsedSec: number;
  requests: number;
  errors: number;
  errorRate: number;
  rps: number;
  avgLatencyMs: number;
  vus: number;
  iterations: number;
  checksRate: number;
}
