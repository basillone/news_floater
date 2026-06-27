import { z } from "zod";

/**
 * Validated server-side environment. Parsed once at first import; throws loudly
 * if anything required is missing or malformed. Never import this into client
 * components — it reads secrets.
 */
const envSchema = z.object({
  // Neon pooled connection — app runtime / serverless (HTTP driver).
  DATABASE_URL: z.string().url(),
  // Neon direct connection — migrations / session-level features.
  DATABASE_URL_UNPOOLED: z.string().url(),
  // OpenAI — embeddings.
  OPENAI_API_KEY: z.string().min(1),
  // Anthropic — summaries + chat.
  ANTHROPIC_API_KEY: z.string().min(1),
  // Shared secret guarding the cron sync route.
  CRON_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
