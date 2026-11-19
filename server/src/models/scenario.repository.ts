import { db } from "../config/db.js";
import type { Scenario, ScenarioThresholds } from "./types.js";

interface ScenarioRow {
  id: string;
  name: string;
  type: string;
  url: string;
  method: string;
  headers: string;
  body: string | null;
  loadMode: string;
  stages: string;
  arrivalRate: number | null;
  duration: string | null;
  preAllocatedVUs: number;
  maxVUs: number;
  thinkTime: number;
  followRedirects: number;
  insecureTls: number;
  expectedStatus: number;
  thresholds: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toScenario(row: ScenarioRow): Scenario {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Scenario["type"],
    url: row.url,
    method: row.method,
    headers: parseJson<Record<string, string>>(row.headers, {}),
    body: row.body,
    loadMode: row.loadMode as Scenario["loadMode"],
    stages: parseJson(row.stages, []),
    arrivalRate: row.arrivalRate,
    duration: row.duration,
    preAllocatedVUs: row.preAllocatedVUs,
    maxVUs: row.maxVUs,
    thinkTime: row.thinkTime,
    followRedirects: Boolean(row.followRedirects),
    insecureTls: Boolean(row.insecureTls),
    expectedStatus: row.expectedStatus,
    thresholds: parseJson<ScenarioThresholds>(row.thresholds, {
      p95Ms: null,
      p99Ms: null,
      maxErrorRate: null,
    }),
    projectId: row.projectId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ScenarioRepository {
  async list(): Promise<Scenario[]> {
    const rows = await db<ScenarioRow>("scenarios").orderBy("createdAt", "desc");
    return rows.map(toScenario);
  }

  async get(id: string): Promise<Scenario | null> {
    const row = await db<ScenarioRow>("scenarios").where({ id }).first();
    return row ? toScenario(row) : null;
  }

  async count(): Promise<number> {
    const result = await db("scenarios").count<{ total: number }[]>({
      total: "*",
    });
    return Number(result[0]?.total ?? 0);
  }

  async create(input: Omit<Scenario, "createdAt" | "updatedAt">): Promise<Scenario> {
    const now = new Date().toISOString();
    const row = {
      ...input,
      headers: JSON.stringify(input.headers),
      stages: JSON.stringify(input.stages),
      thresholds: JSON.stringify(input.thresholds),
      followRedirects: input.followRedirects ? 1 : 0,
      insecureTls: input.insecureTls ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    };
    await db("scenarios").insert(row);
    return { ...input, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: Omit<Scenario, "id" | "createdAt" | "updatedAt">): Promise<Scenario | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    await db("scenarios")
      .where({ id })
      .update({
        ...input,
        headers: JSON.stringify(input.headers),
        stages: JSON.stringify(input.stages),
        thresholds: JSON.stringify(input.thresholds),
        followRedirects: input.followRedirects ? 1 : 0,
        insecureTls: input.insecureTls ? 1 : 0,
        updatedAt: now,
      });
    return { ...existing, ...input, updatedAt: now };
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await db("scenarios").where({ id }).delete();
    return deleted > 0;
  }
}

export const scenarioRepository = new ScenarioRepository();
