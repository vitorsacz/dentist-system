import { z } from "zod";
import { CLINIC_TYPES } from "./enums";

export const createClinicSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(CLINIC_TYPES),
    dailyRentValue: z.coerce.number().positive().optional(),
  })
  .refine((data) => data.type !== "RENTED" || data.dailyRentValue !== undefined, {
    message: "Consultório alugado precisa de valor de diária",
    path: ["dailyRentValue"],
  });
export type CreateClinicInput = z.infer<typeof createClinicSchema>;

export const updateClinicSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(CLINIC_TYPES).optional(),
  dailyRentValue: z.coerce.number().positive().optional(),
});
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
