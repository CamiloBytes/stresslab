import { z } from "zod";

const zapInstanceSchema = z.object({
  uri: z.string().max(2000).optional(),
  method: z.string().max(10).optional(),
  param: z.string().max(300).optional(),
  attack: z.string().max(4000).optional(),
  evidence: z.string().max(8000).optional(),
  otherinfo: z.string().max(8000).optional(),
});

const zapAlertSchema = z.object({
  pluginid: z.union([z.string().max(40), z.number()]).optional(),
  alert: z.string().max(300).optional(),
  name: z.string().max(300).optional(),
  riskcode: z.union([z.string().max(10), z.number()]).optional(),
  risk: z.string().max(40).optional(),
  confidence: z.union([z.string().max(10), z.number()]).optional(),
  cweid: z.union([z.string().max(20), z.number()]).optional(),
  desc: z.string().max(20_000).optional(),
  solution: z.string().max(20_000).optional(),
  reference: z.string().max(4000).optional(),
  instances: z.array(zapInstanceSchema).max(500).optional(),
});

export const zapReportSchema = z
  .object({
    site: z
      .array(
        z.object({
          name: z.string().max(500).optional(),
          alerts: z.array(zapAlertSchema).max(2000).optional(),
        }),
      )
      .max(50)
      .optional(),
    alerts: z.array(zapAlertSchema).max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    const siteAlerts = value.site?.reduce((total, site) => total + (site.alerts?.length ?? 0), 0) ?? 0;
    const total = siteAlerts + (value.alerts?.length ?? 0);
    if (total === 0) {
      ctx.addIssue({
        code: "custom",
        message: "El reporte no contiene alertas (formato no reconocido o escaneo sin hallazgos)",
      });
    }
  });

export type ZapReport = z.infer<typeof zapReportSchema>;

export const assessmentImportSchema = z.object({
  projectId: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  targetUrl: z
    .string()
    .min(1)
    .max(2000)
    .refine((value) => /^https?:\/\/.+/i.test(value), "Debe ser una URL http(s) válida"),
  environment: z.enum(["local", "staging", "production", "other"]).optional(),
  report: zapReportSchema,
});

export type AssessmentImportInput = z.infer<typeof assessmentImportSchema>;

export const findingReviewSchema = z.object({
  status: z.enum(["pending", "confirmed", "dismissed", "remediated"]).optional(),
  reviewNote: z.string().max(2000).nullable().optional(),
});

export type FindingReviewInput = z.infer<typeof findingReviewSchema>;
