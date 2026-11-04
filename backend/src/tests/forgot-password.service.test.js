
import test from "node:test";
import assert from "node:assert/strict";

import {
  requestPasswordReset,
} from "../services/forgot-password.service.js";

import {
  hashPasswordResetToken,
} from "../services/password-reset-token.service.js";

function createPrismaMock({ user, initialTokens = [] }) {
  const state = {
    user: user ? { ...user } : null,
    tokens: initialTokens.map((token) => ({ ...token })),
  };

  const tx = {
    user: {
      findUnique: async ({ where }) => {
        if (
          !state.user ||
          state.user.email !== where.email
        ) {
          return null;
        }

        return { ...state.user };
      },
    },

    passwordResetToken: {
      updateMany: async ({ where, data }) => {
        let count = 0;

        for (const token of state.tokens) {
          if (
            where.id !== undefined &&
            token.id !== where.id
          ) {
            continue;
          }

          if (
            where.userId !== undefined &&
            token.userId !== where.userId
          ) {
            continue;
          }

          if (
            where.usedAt !== undefined &&
            token.usedAt !== where.usedAt
          ) {
            continue;
          }

          if (
            where.revokedAt !== undefined &&
            token.revokedAt !== where.revokedAt
          ) {
            continue;
          }

          Object.assign(token, data);
          count += 1;
        }

        return { count };
      },

      create: async ({ data }) => {
        const record = {
          id: `reset-${state.tokens.length + 1}`,
          ...data,
          usedAt: null,
          revokedAt: null,
        };

        state.tokens.push(record);

        return { id: record.id };
      },
    },
  };

  const prisma = {
    passwordResetToken: tx.passwordResetToken,

    $transaction: async (callback) => callback(tx),
  };

  return { prisma, state };
}

const now = new Date("2026-11-03T10:00:00.000Z");

const testUser = {
  id: "user-1",
  name: "Northstar Test",
  email: "test@example.com",
  emailVerifiedAt: new Date("2026-11-01T10:00:00.000Z"),
};

test("forgot password creates a hashed token and sends email", async () => {
  const { prisma, state } = createPrismaMock({
    user: testUser,
    initialTokens: [
      {
        id: "old-reset",
        userId: "user-1",
        tokenHash: "old-hash",
        expiresAt: new Date("2026-11-03T11:00:00.000Z"),
        usedAt: null,
        revokedAt: null,
      },
      {
        id: "used-reset",
        userId: "user-1",
        tokenHash: "used-hash",
        expiresAt: new Date("2026-11-03T11:00:00.000Z"),
        usedAt: new Date("2026-11-02T10:00:00.000Z"),
        revokedAt: null,
      },
    ],
  });

  let sentEmail;

  const result = await requestPasswordReset(
    " TEST@EXAMPLE.COM ",
    prisma,
    async (input) => {
      sentEmail = input;
    },
    now
  );

  assert.equal(result, true);
  assert.equal(sentEmail.to, testUser.email);
  assert.equal(sentEmail.name, testUser.name);

  const oldToken = state.tokens.find(
    (token) => token.id === "old-reset"
  );

  const usedToken = state.tokens.find(
    (token) => token.id === "used-reset"
  );

  const newToken = state.tokens.find(
    (token) => token.id === "reset-3"
  );

  assert.equal(oldToken.revokedAt.getTime(), now.getTime());
  assert.equal(usedToken.revokedAt, null);

  assert.ok(newToken);

  assert.equal(
    newToken.tokenHash,
    hashPasswordResetToken(sentEmail.token)
  );

  assert.notEqual(
    newToken.tokenHash,
    sentEmail.token
  );

  assert.equal(
    newToken.expiresAt.toISOString(),
    "2026-11-03T10:30:00.000Z"
  );
});

test("forgot password does not send email for an unknown account", async () => {
  const { prisma, state } = createPrismaMock({
    user: null,
  });

  let sendCount = 0;

  const result = await requestPasswordReset(
    "unknown@example.com",
    prisma,
    async () => {
      sendCount += 1;
    },
    now
  );

  assert.equal(result, false);
  assert.equal(sendCount, 0);
  assert.equal(state.tokens.length, 0);
});

test("forgot password does not issue tokens for unverified accounts", async () => {
  const { prisma, state } = createPrismaMock({
    user: {
      ...testUser,
      emailVerifiedAt: null,
    },
  });

  let sendCount = 0;

  const result = await requestPasswordReset(
    testUser.email,
    prisma,
    async () => {
      sendCount += 1;
    },
    now
  );

  assert.equal(result, false);
  assert.equal(sendCount, 0);
  assert.equal(state.tokens.length, 0);
});

test("forgot password revokes the new token when email delivery fails", async () => {
  const { prisma, state } = createPrismaMock({
    user: testUser,
  });

  const result = await requestPasswordReset(
    testUser.email,
    prisma,
    async () => {
      throw new Error("Simulated email provider failure");
    },
    now
  );

  assert.equal(result, false);
  assert.equal(state.tokens.length, 1);
  assert.ok(state.tokens[0].revokedAt instanceof Date);
});
