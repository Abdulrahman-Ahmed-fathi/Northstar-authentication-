import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),

  EMAIL_FROM: z
    .string()
    .email("EMAIL_FROM must be a valid email address")
    .default("onboarding@resend.dev"),

  JWT_ACCESS_SECRET: z
    .string()
    .regex(
      /^[A-Za-z0-9_-]{43}$/,
      "JWT_ACCESS_SECRET must be a valid 32-byte base64url secret"
    )
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");

  for (const issue of result.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }

  process.exit(1);
}

export const env = result.data;
