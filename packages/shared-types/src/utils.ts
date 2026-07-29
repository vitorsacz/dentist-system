import { z } from "zod";

// Inputs HTML <input type="date"> mandam "" quando vazios, não undefined —
// sem esse preprocess, z.coerce.date().optional() tenta `new Date("")` (Invalid Date)
// e falha a validação em vez de tratar como "não preenchido".
export const optionalCoercedDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);
