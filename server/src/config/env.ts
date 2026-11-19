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
  awsRegion: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  bedrockModelId: process.env.BEDROCK_MODEL_ID ?? "",
  aiProvider: process.env.AI_PROVIDER ?? "",
  openrouterApiKey: process.env.OPENROUTER_API_KEY?.trim() ?? "",
  openrouterModel: process.env.OPENROUTER_MODEL || "openrouter/free",
  openrouterBaseUrl: "https://openrouter.ai/api/v1",
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  openaiBaseUrl: "https://api.openai.com/v1",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
  anthropicBaseUrl: "https://api.anthropic.com/v1",
} as const;
