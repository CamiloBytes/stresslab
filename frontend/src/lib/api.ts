import type {
  ApiError,
  AssessmentComparison,
  AssessmentImportInput,
  FindingStatus,
  Health,
  Project,
  ProjectInput,
  Run,
  Scenario,
  ScenarioInput,
  SecurityAssessment,
  SecurityFinding,
} from "./types";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly issues: Array<{ path: string; message: string }>;

  constructor(status: number, message: string, issues: Array<{ path: string; message: string }> = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as T | ApiError | null;

  if (!response.ok) {
    const error = payload as ApiError | null;
    throw new ApiRequestError(
      response.status,
      error?.error ?? `Error ${response.status}`,
      error?.issues ?? [],
    );
  }

  return payload as T;
}

export const api = {
  health: () => request<Health>("/api/health"),

  listScenarios: () => request<Scenario[]>("/api/scenarios"),
  createScenario: (input: ScenarioInput) =>
    request<Scenario>("/api/scenarios", { method: "POST", body: JSON.stringify(input) }),
  updateScenario: (id: string, input: ScenarioInput) =>
    request<Scenario>(`/api/scenarios/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteScenario: (id: string) =>
    request<void>(`/api/scenarios/${id}`, { method: "DELETE" }),

  listRuns: (limit = 50) => request<Run[]>(`/api/runs?limit=${limit}`),
  getRun: (id: string) => request<Run>(`/api/runs/${id}`),
  startRun: (scenarioId: string) =>
    request<Run>("/api/runs", { method: "POST", body: JSON.stringify({ scenarioId }) }),
  stopRun: () => request<Run>("/api/runs/stop", { method: "POST" }),
  getActiveRun: () => request<{ run: Run; metrics: unknown } | null>("/api/runs/active"),

  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (input: ProjectInput) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
  updateProject: (id: string, input: ProjectInput) =>
    request<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),

  listAssessments: (projectId?: string) =>
    request<{ assessments: SecurityAssessment[]; aiAvailable: boolean }>(
      `/api/security/assessments${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
    ),
  getAssessment: (id: string) =>
    request<{ assessment: SecurityAssessment; findings: SecurityFinding[] }>(
      `/api/security/assessments/${id}`,
    ),
  importAssessment: (input: AssessmentImportInput) =>
    request<SecurityAssessment>("/api/security/assessments", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reviewFinding: (id: string, input: { status?: FindingStatus; reviewNote?: string | null }) =>
    request<SecurityFinding>(`/api/security/findings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  analyzeAssessment: (id: string) =>
    request<SecurityAssessment>(`/api/security/assessments/${id}/analyze`, { method: "POST" }),
  compareAssessments: (from: string, to: string) =>
    request<AssessmentComparison>(
      `/api/security/assessments/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  assessmentReportUrl: (id: string, withRun = false) =>
    `/api/security/assessments/${id}/report${withRun ? "?withRun=true" : ""}`,
};
