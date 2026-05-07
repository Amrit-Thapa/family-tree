import { z } from 'zod';

export const signInBodySchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

export type SignInBody = z.infer<typeof signInBodySchema>;
