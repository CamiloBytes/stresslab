import type { Request, Response } from "express";
import { HttpError } from "../middleware/http-error.js";
import { scenarioInputSchema } from "../models/scenario.schema.js";
import { scenarioRepository } from "../models/scenario.repository.js";

export async function listScenarios(_request: Request, response: Response): Promise<void> {
  const scenarios = await scenarioRepository.list();
  response.json(scenarios);
}

export async function getScenario(request: Request, response: Response): Promise<void> {
  const scenario = await scenarioRepository.get(String(request.params.id));
  if (!scenario) throw new HttpError(404, "Escenario no encontrado");
  response.json(scenario);
}

export async function createScenario(request: Request, response: Response): Promise<void> {
  const input = scenarioInputSchema.parse(request.body);
  const scenario = await scenarioRepository.create({ id: crypto.randomUUID(), ...input });
  response.status(201).json(scenario);
}

export async function updateScenario(request: Request, response: Response): Promise<void> {
  const input = scenarioInputSchema.parse(request.body);
  const scenario = await scenarioRepository.update(String(request.params.id), input);
  if (!scenario) throw new HttpError(404, "Escenario no encontrado");
  response.json(scenario);
}

export async function deleteScenario(request: Request, response: Response): Promise<void> {
  const removed = await scenarioRepository.remove(String(request.params.id));
  if (!removed) throw new HttpError(404, "Escenario no encontrado");
  response.status(204).end();
}
