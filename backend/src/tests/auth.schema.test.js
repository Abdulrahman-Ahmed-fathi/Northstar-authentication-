
import test from "node:test";
import assert from "node:assert/strict";

import {
  registerSchema,
  loginSchema,
} from "../schemas/auth.schema.js";

test("registration accepts valid data and normalizes email", () => {
  const result = registerSchema.safeParse({
    name: "  Abdulrahman Ahmed  ",
    email: " USER@EXAMPLE.COM ",
    password: "correct horse battery staple",
  });

  assert.ok(result.success);
  assert.equal(result.data.name, "Abdulrahman Ahmed");
  assert.equal(result.data.email, "user@example.com");
});

test("registration rejects an invalid email", () => {
  const result = registerSchema.safeParse({
    name: "Abdo",
    email: "not-an-email",
    password: "correct horse battery staple",
  });

  assert.equal(result.success, false);
});

test("registration rejects a short password", () => {
  const result = registerSchema.safeParse({
    name: "Abdo",
    email: "abdo@example.com",
    password: "Short123!",
  });

  assert.equal(result.success, false);
});

test("login accepts a non-empty password and normalizes email", () => {
  const result = loginSchema.safeParse({
    email: " USER@EXAMPLE.COM ",
    password: "short",
  });

  assert.ok(result.success);
  assert.equal(result.data.email, "user@example.com");
});
