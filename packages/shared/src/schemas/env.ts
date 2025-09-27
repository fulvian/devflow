import { z } from 'zod';

export const OpenRouterEnvSchema = z.object({
  OPENROUTER_BASE_URL: z.string().url().optional(),
  OPENROUTER_TIMEOUT_MS: z
    .string()
    .transform((v) => (v.trim() === '' ? undefined : Number(v)))
    .pipe(z.number().positive().int().optional())
    .optional(),
  OPENROUTER_MAX_RETRIES: z
    .string()
    .transform((v) => (v.trim() === '' ? undefined : Number(v)))
    .pipe(z.number().min(0).int().optional())
    .optional(),
  OPENROUTER_PREFERRED_MODELS: z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .optional(),
  OPENROUTER_COST_BUDGET_USD: z
    .string()
    .transform((v) => (v.trim() === '' ? undefined : Number(v)))
    .pipe(z.number().nonnegative().optional())
    .optional(),
});

export type OpenRouterEnv = z.infer<typeof OpenRouterEnvSchema>;

export function loadOpenRouterEnv(env: NodeJS.ProcessEnv = process.env): OpenRouterEnv {
  const parsed = OpenRouterEnvSchema.safeParse(env);
  if (!parsed.success) {
    // Best-effort: return empty object on invalid env; callers provide defaults
    return {};
  }
  return parsed.data;
}

// Core (database) environment
export const CoreEnvSchema = z.object({
  DEVFLOW_DB_PATH: z.string().min(1).optional(),
  DEVFLOW_DB_READONLY: z
    .string()
    .transform((v) => ['1', 'true', 'yes'].includes(v.toLowerCase()))
    .optional(),
  DEVFLOW_DB_VERBOSE: z
    .string()
    .transform((v) => ['1', 'true', 'yes'].includes(v.toLowerCase()))
    .optional(),
});

export type CoreEnv = z.infer<typeof CoreEnvSchema>;

export function loadCoreEnv(env: NodeJS.ProcessEnv = process.env): CoreEnv {
  const result = CoreEnvSchema.safeParse(env);
  return result.success ? result.data : {};
}

// Synthetic.new environment
export const SyntheticEnvSchema = z.object({
  SYNTHETIC_API_KEY: z.string().min(1),
  SYNTHETIC_BASE_URL: z.string().url().default('https://api.synthetic.new/v1'),
  SYNTHETIC_TIMEOUT_MS: z
    .string()
    .transform((v) => (v.trim() === '' ? undefined : Number(v)))
    .pipe(z.number().positive().int().optional())
    .optional(),
  SYNTHETIC_MAX_RETRIES: z
    .string()
    .transform((v) => (v.trim() === '' ? undefined : Number(v)))
    .pipe(z.number().min(0).int().optional())
    .optional(),
  SYNTHETIC_PREFERRED_MODELS: z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .optional(),
});

export type SyntheticEnv = z.infer<typeof SyntheticEnvSchema>;

export function loadSyntheticEnv(env: NodeJS.ProcessEnv = process.env): SyntheticEnv {
  const parsed = SyntheticEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid Synthetic.new configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}
