import type { Request, Response } from "express";
import { HttpError } from "../middleware/http-error.js";
import { projectInputSchema } from "../models/project.schema.js";
import { projectRepository } from "../models/project.repository.js";

export async function listProjects(_request: Request, response: Response): Promise<void> {
  const projects = await projectRepository.list();
  response.json(projects);
}

export async function getProject(request: Request, response: Response): Promise<void> {
  const project = await projectRepository.get(String(request.params.id));
  if (!project) throw new HttpError(404, "Proyecto no encontrado");
  response.json(project);
}

export async function createProject(request: Request, response: Response): Promise<void> {
  const input = projectInputSchema.parse(request.body);
  const project = await projectRepository.create(crypto.randomUUID(), input);
  response.status(201).json(project);
}

export async function updateProject(request: Request, response: Response): Promise<void> {
  const input = projectInputSchema.parse(request.body);
  const project = await projectRepository.update(String(request.params.id), input);
  if (!project) throw new HttpError(404, "Proyecto no encontrado");
  response.json(project);
}

export async function deleteProject(request: Request, response: Response): Promise<void> {
  const project = await projectRepository.get(String(request.params.id));
  if (!project) throw new HttpError(404, "Proyecto no encontrado");

  const linked = await projectRepository.hasLinkedData(project.id);
  if (linked) {
    throw new HttpError(409, "El proyecto tiene escenarios o evaluaciones vinculados; desasócialos antes de eliminarlo");
  }

  await projectRepository.remove(project.id);
  response.status(204).end();
}
