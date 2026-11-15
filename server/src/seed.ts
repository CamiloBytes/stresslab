import { scenarioRepository } from "./models/scenario.repository.js";
import type { Scenario } from "./models/types.js";

const EXAMPLES: Array<Omit<Scenario, "createdAt" | "updatedAt">> = [
  {
    id: "seed-api-health",
    name: "API — Health check (baseline)",
    type: "api" as const,
    url: "http://localhost:3000/api/health",
    method: "GET",
    headers: {},
    body: null,
    loadMode: "ramping-vus" as const,
    stages: [
      { duration: "20s", target: 10 },
      { duration: "30s", target: 10 },
      { duration: "20s", target: 0 },
    ],
    arrivalRate: null,
    duration: null,
    preAllocatedVUs: 50,
    maxVUs: 200,
    thinkTime: 0.5,
    followRedirects: true,
    insecureTls: false,
    expectedStatus: 200,
    thresholds: { p95Ms: 500, p99Ms: 1000, maxErrorRate: 0.01 },
  },
  {
    id: "seed-web-home",
    name: "WEB — Página principal (tráfico constante)",
    type: "web" as const,
    url: "http://localhost:3000/",
    method: "GET",
    headers: { "User-Agent": "StressLab/1.0" },
    body: null,
    loadMode: "constant-arrival-rate" as const,
    stages: [{ duration: "1m", target: 0 }],
    arrivalRate: 5,
    duration: "1m",
    preAllocatedVUs: 30,
    maxVUs: 100,
    thinkTime: 0,
    followRedirects: true,
    insecureTls: false,
    expectedStatus: 200,
    thresholds: { p95Ms: 800, p99Ms: null, maxErrorRate: 0.05 },
  },
];

export async function seedExamples(): Promise<void> {
  const count = await scenarioRepository.count();
  if (count > 0) return;
  for (const example of EXAMPLES) {
    await scenarioRepository.create(example);
  }
  console.log("[stresslab] Escenarios de ejemplo creados");
}
