import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "./http-error.js";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    response.status(400).json({ error: "Datos inválidos", issues });
    return;
  }

  const message = error instanceof Error ? error.message : "Error interno del servidor";
  console.error("[stresslab]", error);
  response.status(500).json({ error: message });
}
