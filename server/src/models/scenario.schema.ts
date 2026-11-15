import { z } from "zod";

const stageSchema = z.object({
  duration: z
    .string()
    .regex(/^\d+[smh]$/, "Formato de duración inválido (ej: 30s, 2m)"),
  target: z.number().int().min(0).max(100_000),
});

const durationString = z
  .string()
  .regex(/^\d+[smh]$/, "Formato de duración inválido (ej: 30s, 2m)");

export const scenarioInputSchema = z
  .object({
    name: z.string().min(1).max(120),
    type: z.enum(["api", "web"]),
    url: z
      .string()
      .min(1)
      .refine(
        (value) => /^https?:\/\/.+/i.test(value),
        "Debe ser una URL http(s) válida, pública o privada",
      ),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
      .default("GET"),
    headers: z.record(z.string(), z.string()).default({}),
    body: z.string().nullable().default(null),
    loadMode: z.enum(["ramping-vus", "constant-arrival-rate"]).default("ramping-vus"),
    stages: z.array(stageSchema).min(1).max(20),
    arrivalRate: z.number().int().min(1).max(100_000).nullable().default(null),
    duration: durationString.nullable().default(null),
    preAllocatedVUs: z.number().int().min(1).max(10_000).default(50),
    maxVUs: z.number().int().min(1).max(50_000).default(200),
    thinkTime: z.number().min(0).max(60).default(0),
    followRedirects: z.boolean().default(true),
    insecureTls: z.boolean().default(false),
    expectedStatus: z.number().int().min(100).max(599).default(200),
    thresholds: z
      .object({
        p95Ms: z.number().min(1).max(600_000).nullable().default(null),
        p99Ms: z.number().min(1).max(600_000).nullable().default(null),
        maxErrorRate: z.number().min(0).max(1).nullable().default(null),
      })
      .default({ p95Ms: null, p99Ms: null, maxErrorRate: null }),
  })
  .superRefine((value, ctx) => {
    if (value.loadMode === "constant-arrival-rate") {
      if (!value.arrivalRate) {
        ctx.addIssue({
          code: "custom",
          path: ["arrivalRate"],
          message: "Indica las peticiones por segundo (arrivalRate)",
        });
      }
      if (!value.duration) {
        ctx.addIssue({
          code: "custom",
          path: ["duration"],
          message: "Indica la duración total (ej: 1m)",
        });
      }
    } else if (value.stages.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["stages"],
        message: "Agrega al menos una etapa de carga",
      });
    }
  });

export type ScenarioInput = z.infer<typeof scenarioInputSchema>;
