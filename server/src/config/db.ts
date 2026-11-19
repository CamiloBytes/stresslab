import fs from "node:fs";
import path from "node:path";
import knex, { type Knex } from "knex";
import { env } from "./env.js";

function buildConfig(): Knex.Config {
  if (env.dbClient === "mysql") {
    return {
      client: "mysql2",
      connection: {
        host: env.dbHost,
        port: env.dbPort ?? 3306,
        user: env.dbUser,
        password: env.dbPassword,
        database: env.dbName,
      },
    };
  }

  if (env.dbClient === "pg") {
    return {
      client: "pg",
      connection: {
        host: env.dbHost,
        port: env.dbPort ?? 5432,
        user: env.dbUser,
        password: env.dbPassword,
        database: env.dbName,
      },
    };
  }

  const filename = path.resolve(env.dbFile);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  return {
    client: "better-sqlite3",
    connection: { filename },
    pool: {min:1,max:1},
    useNullAsDefault: true,
  };
}

export const db = knex(buildConfig());

export function migrationsDir(): string {
  return path.resolve(import.meta.dirname, "../../migrations");
}

export async function initDatabase(): Promise<void> {
  await db.migrate.latest({ directory: migrationsDir() });
}
