import { z } from 'zod';
export const PilApiSchema = z.object({
    success: z.boolean(),
    data: z.string(),
});
