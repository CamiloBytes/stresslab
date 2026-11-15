import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { detectK6 } from "../services/k6.service.js";
import { runService } from "../services/run.service.js";

export async function getHealth(_request: Request, response: Response): Promise<void> {
  const k6 = await detectK6();
  const active = runService.getActive();

  response.json({
    status: "ok",
    service: "stresslab-api",
    k6,
    database: env.dbClient,
    activeRunId: active?.run.id ?? null,
    uptimeSec: Math.round(process.uptime()),
  });
}
