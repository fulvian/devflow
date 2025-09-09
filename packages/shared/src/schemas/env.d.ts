import { z } from 'zod';
export declare const OpenRouterEnvSchema: z.ZodObject<{
    OPENROUTER_BASE_URL: z.ZodOptional<z.ZodString>;
    OPENROUTER_TIMEOUT_MS: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number | undefined, string>>, z.ZodOptional<z.ZodNumber>>>;
    OPENROUTER_MAX_RETRIES: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number | undefined, string>>, z.ZodOptional<z.ZodNumber>>>;
    OPENROUTER_PREFERRED_MODELS: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string[], string>>>;
    OPENROUTER_COST_BUDGET_USD: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number | undefined, string>>, z.ZodOptional<z.ZodNumber>>>;
}, z.core.$strip>;
export type OpenRouterEnv = z.infer<typeof OpenRouterEnvSchema>;
export declare function loadOpenRouterEnv(env?: NodeJS.ProcessEnv): OpenRouterEnv;
export declare const CoreEnvSchema: z.ZodObject<{
    DEVFLOW_DB_PATH: z.ZodOptional<z.ZodString>;
    DEVFLOW_DB_READONLY: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<boolean, string>>>;
    DEVFLOW_DB_VERBOSE: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<boolean, string>>>;
}, z.core.$strip>;
export type CoreEnv = z.infer<typeof CoreEnvSchema>;
export declare function loadCoreEnv(env?: NodeJS.ProcessEnv): CoreEnv;
export declare const SyntheticEnvSchema: z.ZodObject<{
    SYNTHETIC_API_KEY: z.ZodString;
    SYNTHETIC_BASE_URL: z.ZodDefault<z.ZodString>;
    SYNTHETIC_TIMEOUT_MS: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number | undefined, string>>, z.ZodOptional<z.ZodNumber>>>;
    SYNTHETIC_MAX_RETRIES: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number | undefined, string>>, z.ZodOptional<z.ZodNumber>>>;
    SYNTHETIC_PREFERRED_MODELS: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string[], string>>>;
}, z.core.$strip>;
export type SyntheticEnv = z.infer<typeof SyntheticEnvSchema>;
export declare function loadSyntheticEnv(env?: NodeJS.ProcessEnv): SyntheticEnv;
//# sourceMappingURL=env.d.ts.map