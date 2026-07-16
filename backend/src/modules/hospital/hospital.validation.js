import { z } from "zod";

export const hospitalQuerySchema = z.object({
  specialization: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

export const createHospitalSchema = z.object({
  name: z.string().min(2, "Name is required"),
  address: z.string().min(5, "Address is required"),
  lat: z.number(),
  lng: z.number(),
  specializations: z.array(z.string()).optional()
});

export const updateHospitalSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  specializations: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});