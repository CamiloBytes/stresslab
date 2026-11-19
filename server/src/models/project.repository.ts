import { db } from "../config/db.js";
import type { Project } from "./types.js";
import type { ProjectInput } from "./project.schema.js";

interface ProjectRow {
  id: string;
  name: string;
  environment: string;
  scope: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseScope(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    environment: row.environment as Project["environment"],
    scope: parseScope(row.scope),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ProjectRepository {
  async list(): Promise<Project[]> {
    const rows = await db<ProjectRow>("projects").orderBy("createdAt", "desc");
    return rows.map(toProject);
  }

  async get(id: string): Promise<Project | null> {
    const row = await db<ProjectRow>("projects").where({ id }).first();
    return row ? toProject(row) : null;
  }

  async count(): Promise<number> {
    const result = await db("projects").count<{ total: number }[]>({ total: "*" });
    return Number(result[0]?.total ?? 0);
  }

  async create(id: string, input: ProjectInput): Promise<Project> {
    const now = new Date().toISOString();
    const row = {
      id,
      name: input.name,
      environment: input.environment,
      scope: JSON.stringify(input.scope),
      createdAt: now,
      updatedAt: now,
    };
    await db("projects").insert(row);
    return { id, ...input, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: ProjectInput): Promise<Project | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    await db("projects")
      .where({ id })
      .update({
        name: input.name,
        environment: input.environment,
        scope: JSON.stringify(input.scope),
        updatedAt: now,
      });
    return { ...existing, ...input, updatedAt: now };
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await db("projects").where({ id }).delete();
    return deleted > 0;
  }

  async hasLinkedData(id: string): Promise<boolean> {
    const scenarios = await db("scenarios").where({ projectId: id }).count<{ total: number }[]>({ total: "*" });
    if (Number(scenarios[0]?.total ?? 0) > 0) return true;
    const assessments = await db("security_assessments")
      .where({ projectId: id })
      .count<{ total: number }[]>({ total: "*" });
    return Number(assessments[0]?.total ?? 0) > 0;
  }
}

export const projectRepository = new ProjectRepository();
