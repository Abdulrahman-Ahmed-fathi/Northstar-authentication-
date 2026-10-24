
import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "Email address is too long");

export const passwordSchema = z
  .string()
  .min(15, "Password must be at least 15 characters")
  .max(128, "Password must not exceed 128 characters");

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must not exceed 80 characters"),

  email: emailSchema,

  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,

  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password must not exceed 128 characters"),
});
