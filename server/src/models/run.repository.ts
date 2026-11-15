import { db } from "../config/db.js";
import type { Run, RunStatus, RunSummary } from "./types.js";

interface RunRow {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  error: string | null;
}

function toRun(row: RunRow): Run {
  let summary: RunSummary | null = null;
  if (row.summary) {
    try {
      summary = JSON.parse(row.summary) as RunSummary;
    } catch {
      summary = null;
    }
  }
  return {
    id: row.id,
    scenarioId: row.scenarioId,
    scenarioName: row.scenarioName,
    status: row.status as RunStatus,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    summary,
    error: row.error,
  };
}

export class RunRepository {
  async create(input: Pick<Run, "id" | "scenarioId" | "scenarioName" | "startedAt">): Promise<Run> {
    const row = { ...input, status: "running", endedAt: null, summary: null, error: null };
    await db("runs").insert(row);
    return { ...input, status: "running", endedAt: null, summary: null, error: null };
  }

  async update(
    id: string,
    patch: Partial<Pick<Run, "status" | "endedAt" | "summary" | "error">>,
  ): Promise<void> {
    await db("runs")
      .where({ id })
      .update({
        ...patch,
        summary: patch.summary ? JSON.stringify(patch.summary) : undefined,
      });
  }

  async get(id: string): Promise<Run | null> {
    const row = await db<RunRow>("runs").where({ id }).first();
    return row ? toRun(row) : null;
  }

  async list(limit = 50): Promise<Run[]> {
    const rows = await db<RunRow>("runs")
      .orderBy("startedAt", "desc")
      .limit(limit);
    return rows.map(toRun);
  }

  async lastRunning(): Promise<Run | null> {
    const row = await db<RunRow>("runs")
      .where({ status: "running" })
      .orderBy("startedAt", "desc")
      .first();
    return row ? toRun(row) : null;
  }

  async markInterrupted(): Promise<void> {
    await db("runs")
      .where({ status: "running" })
      .update({ status: "failed", endedAt: new Date().toISOString(), error: "Servidor reiniciado durante la corrida" });
  }
}

export const runRepository = new RunRepository();
