import type { ApiError, Health, Run, Scenario, ScenarioInput } from "./types";

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
};
