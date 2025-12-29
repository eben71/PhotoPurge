import { z } from "zod";

export const HealthStatusSchema = z.object({
  status: z.string(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
