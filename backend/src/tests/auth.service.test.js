
import test from "node:test";
import assert from "node:assert/strict";

import { registerUser } from "../services/auth.service.js";
import { ApiError } from "../utils/ApiError.js";

function createPrismaMock() {
  const persisted = {
    users: [],
    tokens: [],
  };

  const tx = {
    user: {
      create: async ({ data }) => {
        if (persisted.users.some((user) => user.email === data.email)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          error.meta = { target: ["email"] };
          throw error;
        }

        const user = {
          id: `user-${persisted.users.length + 1}`,
          ...data,
          emailVerifiedAt: null,
          createdAt: new Date(),
        };

        persisted.users.push(user);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt,
          createdAt: user.createdAt,
        };
      },
    },

    emailVerificationToken: {
  create: async ({ data }) => {
    const record = {
      id: `token-${persisted.tokens.length + 1}`,
      ...data,
    };

    persisted.tokens.push(record);

    return { id: record.id };
  },
},
  };

  return {
    persisted,
    $transaction: async (callback) => callback(tx),
  };
}

const validInput = {
  name: "  Abdulrahman Ahmed  ",
  email: " USER@EXAMPLE.COM ",
  password: "correct horse battery staple",
};

test("registration stores a hashed password and token hash", async () => {
  const prisma = createPrismaMock();

  const result = await registerUser(validInput, prisma);

  assert.equal(result.user.name, "Abdulrahman Ahmed");
  assert.equal(result.user.email, "user@example.com");

  assert.equal(prisma.persisted.users.length, 1);
  assert.match(
    prisma.persisted.users[0].passwordHash,
    /^\$argon2id\$/
  );
  assert.equal(
  result.verificationTokenRecordId,
  "token-1"
);

  assert.notEqual(
    prisma.persisted.users[0].passwordHash,
    validInput.password
  );

  assert.equal(prisma.persisted.tokens.length, 1);
  assert.equal(
    prisma.persisted.tokens[0].userId,
    result.user.id
  );

  assert.match(
    prisma.persisted.tokens[0].tokenHash,
    /^[a-f0-9]{64}$/
  );

  assert.notEqual(
    result.verificationToken,
    prisma.persisted.tokens[0].tokenHash
  );

  assert.equal(result.user.passwordHash, undefined);
});

test("registration rejects an already registered email", async () => {
  const prisma = createPrismaMock();

  await registerUser(validInput, prisma);

  await assert.rejects(
    () => registerUser(validInput, prisma),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 409);
      return true;
    }
  );

  assert.equal(prisma.persisted.users.length, 1);
});
