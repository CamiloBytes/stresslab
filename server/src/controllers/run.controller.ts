import type { Request, Response } from "express";
import { z } from "zod";
import { runRepository } from "../models/run.repository.js";
import { scenarioRepository } from "../models/scenario.repository.js";
import { buildRunReportPdf } from "../services/report.service.js";
import { runService } from "../services/run.service.js";
import { sseHub } from "../services/sse.service.js";

const startSchema = z.object({
  scenarioId: z.string().min(1),
});

export async function listRuns(request: Request, response: Response): Promise<void> {
  const limit = Number(request.query.limit ?? 50);
  const runs = await runRepository.list(Number.isFinite(limit) ? limit : 50);
  response.json(runs);
}

export async function getRun(request: Request, response: Response): Promise<void> {
  const run = await runRepository.get(String(request.params.id));
  if (!run) {
    response.status(404).json({ error: "Corrida no encontrada" });
    return;
  }

  response.json(run);
}

export async function downloadRunReport(request: Request, response: Response): Promise<void> {
  const run = await runRepository.get(String(request.params.id));
  if (!run) {
    response.status(404).json({ error: "Corrida no encontrada" });
    return;
  }
  const scenario = await scenarioRepository.get(run.scenarioId);
  if (!scenario) {
    response.status(404).json({ error: "Escenario de la corrida no encontrado" });
    return;
  }

  const filename = `stresslab-${run.id.slice(0, 8)}.pdf`;
  response
    .status(200)
    .setHeader("Content-Type", "application/pdf")
    .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    .send(await buildRunReportPdf(run, scenario));
}

export async function startRun(request: Request, response: Response): Promise<void> {
  const { scenarioId } = startSchema.parse(request.body);
  const run = await runService.start(scenarioId);
  response.status(201).json(run);
}

export function stopRun(_request: Request, response: Response): void {
  const run = runService.stop();
  response.json(run);
}

export function getActiveRun(_request: Request, response: Response): void {
  response.json(runService.getActive());
}

export function streamEvents(request: Request, response: Response): void {
  sseHub.subscribe(response);
  const active = runService.getActive();
  if (active) {
    response.write(
      `event: status\ndata: ${JSON.stringify({ run: active.run })}\n\n`,
    );
    response.write(
      `event: metrics\ndata: ${JSON.stringify({ runId: active.run.id, ...active.metrics })}\n\n`,
    );
  }
}
