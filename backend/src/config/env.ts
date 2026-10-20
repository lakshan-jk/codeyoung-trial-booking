import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/** Schema for environment configuration — fails fast with a clear message. */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z
    .string()
    .min(1)
    .default('mongodb://localhost:27017/codeyoung?replicaSet=rs0&directConnection=true'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Base URL for the (dummy) class link. Points at the app's in-app demo room so
  // the link actually opens something. In production this would be the real video
  // platform (e.g. https://class.codeyoung.com/room).
  CLASS_LINK_BASE_URL: z.string().default('http://localhost:5173/room'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/** Centralised, validated access to environment configuration. */
export const env = {
  port: parsed.data.PORT,
  mongoUri: parsed.data.MONGODB_URI,
  corsOrigins: parsed.data.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  classLinkBaseUrl: parsed.data.CLASS_LINK_BASE_URL.replace(/\/$/, ''),
} as const;
