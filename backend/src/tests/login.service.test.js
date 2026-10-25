
import test from "node:test";
import assert from "node:assert/strict";

import { hashPassword } from "../services/password.service.js";
import { loginUser } from "../services/login.service.js";
import { ApiError } from "../utils/ApiError.js";

const correctPassword = "correct horse battery staple";

async function createUser(overrides = {}) {
  return {
    id: "user-123",
    name: "Northstar Test",
    email: "user@example.com",
    passwordHash: await hashPassword(correctPassword),
    emailVerifiedAt: new Date("2026-10-20T12:00:00.000Z"),
    createdAt: new Date("2026-10-20T10:00:00.000Z"),
    ...overrides,
  };
}

function createPrismaMock(user) {
  return {
    user: {
      findUnique: async ({ where }) => {
        if (user && user.email === where.email) {
          return user;
        }

        return null;
      },
    },
  };
}

test("login accepts valid credentials and returns safe user data", async () => {
  const user = await createUser();
  const prisma = createPrismaMock(user);

  const result = await loginUser(
    {
      email: " USER@EXAMPLE.COM ",
      password: correctPassword,
    },
    prisma
  );

  assert.equal(result.id, user.id);
  assert.equal(result.email, "user@example.com");
  assert.equal(result.passwordHash, undefined);
});

test("login rejects an incorrect password with a generic error", async () => {
  const user = await createUser();
  const prisma = createPrismaMock(user);

  await assert.rejects(
    () =>
      loginUser(
        {
          email: user.email,
          password: "wrong password",
        },
        prisma
      ),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, "Invalid email or password.");
      return true;
    }
  );
});

test("login rejects an unknown email with the same generic error", async () => {
  const prisma = createPrismaMock(null);

  await assert.rejects(
    () =>
      loginUser(
        {
          email: "unknown@example.com",
          password: correctPassword,
        },
        prisma
      ),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, "Invalid email or password.");
      return true;
    }
  );
});

test("login rejects a correct password when email is unverified", async () => {
  const user = await createUser({
    emailVerifiedAt: null,
  });

  const prisma = createPrismaMock(user);

  await assert.rejects(
    () =>
      loginUser(
        {
          email: user.email,
          password: correctPassword,
        },
        prisma
      ),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 403);
      assert.equal(
        error.message,
        "Email address must be verified before signing in."
      );
      return true;
    }
  );
});
