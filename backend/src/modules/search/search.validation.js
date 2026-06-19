import { z } from "zod";

export const symptomSchema = z.object({
  symptom: z.string().min(2, "Symptom is required")
});