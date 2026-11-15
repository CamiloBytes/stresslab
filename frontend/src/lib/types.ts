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
  createdAt: string;
  updatedAt: string;
}

export type ScenarioInput = Omit<Scenario, "id" | "createdAt" | "updatedAt">;

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
  status: RunStatus;
  startedAt: string;
  endedAt: string | null;
  summary: RunSummary | null;
  error: string | null;
}

export interface LiveMetrics {
  runId: string;
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

export interface Health {
  status: string;
  service: string;
  k6: { available: boolean; version: string | null; mode: string | null };
  database: string;
  activeRunId: string | null;
  uptimeSec: number;
}

export interface ApiError {
  error: string;
  issues?: Array<{ path: string; message: string }>;
}
