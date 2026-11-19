import { z } from "zod";

export const projectInputSchema = z.object({
  name: z.string().min(1).max(120),
  environment: z.enum(["local", "staging", "production", "other"]).default("staging"),
  scope: z
    .array(z.string().min(1).max(300))
    .max(20)
    .default([]),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
