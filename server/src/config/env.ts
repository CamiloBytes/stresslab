import fs from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // .env is optional
}

function optionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  dbClient: (process.env.DB_CLIENT ?? "better-sqlite3") as
    | "better-sqlite3"
    | "mysql"
    | "pg",
  dbFile: process.env.DB_FILE ?? "data/stresslab.db",
  dbHost: process.env.DB_HOST ?? "localhost",
  dbPort: optionalNumber(process.env.DB_PORT),
  dbUser: process.env.DB_USER ?? "root",
  dbPassword: process.env.DB_PASSWORD ?? "",
  dbName: process.env.DB_NAME ?? "stresslab",
  runsDir: process.env.RUNS_DIR ?? "data/runs",
  k6DockerImage: process.env.K6_DOCKER_IMAGE ?? "grafana/k6",
} as const;

export type Env = typeof env;
