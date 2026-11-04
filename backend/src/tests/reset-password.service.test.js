
import test from "node:test";
import assert from "node:assert/strict";

import {
  resetPassword,
} from "../services/reset-password.service.js";

import {
  hashPasswordResetToken,
} from "../services/password-reset-token.service.js";

import {
  hashPassword,
  verifyPassword,
} from "../services/password.service.js";

const now = new Date("2026-11-04T10:00:00.000Z");

const testUser = {
  id: "user-1",
  name: "Northstar Test",
  email: "test@example.com",
  passwordHash: "old-password-hash",
};

const validToken = "valid-reset-token";

function createPrismaMock({
  user = testUser,
  tokens = [],
  refreshTokens = [],
  failRefreshUpdate = false,
} = {}) {
  const state = {
    user: user ? { ...user } : null,
    tokens: tokens.map((token) => ({ ...token })),
    refreshTokens: refreshTokens.map((token) => ({ ...token })),
  };

  let transactionQueue = Promise.resolve();
  
function matchesToken(token, where) {
  if (typeof where.id === "string" && token.id !== where.id) {
    return false;
  }

  if (
    where.id?.not !== undefined &&
    token.id === where.id.not
  ) {
    return false;
  }

  if (
    where.userId !== undefined &&
    token.userId !== where.userId
  ) {
    return false;
  }

  if (
    where.usedAt !== undefined &&
    token.usedAt !== where.usedAt
  ) {
    return false;
  }

  if (
    where.revokedAt !== undefined &&
    token.revokedAt !== where.revokedAt
  ) {
    return false;
  }

  if (
    where.expiresAt?.gt !== undefined &&
    token.expiresAt <= where.expiresAt.gt
  ) {
    return false;
  }

  return true;
}


  function createTransaction(draft) {
    return {
      passwordResetToken: {
        findUnique: async ({ where }) => {
          const token = draft.tokens.find(
            (item) => item.tokenHash === where.tokenHash
          );

          return token ? { ...token } : null;
        },

        updateMany: async ({ where, data }) => {
          let count = 0;

          for (const token of draft.tokens) {
            if (!matchesToken(token, where)) {
              continue;
            }

            Object.assign(token, data);
            count += 1;
          }

          return { count };
        },
      },

      user: {
        update: async ({ where, data }) => {
          if (!draft.user || draft.user.id !== where.id) {
            throw new Error("User not found.");
          }

          Object.assign(draft.user, data);

          return { ...draft.user };
        },
      },

      refreshToken: {
        updateMany: async ({ where, data }) => {
          if (failRefreshUpdate) {
            throw new Error("Simulated database failure.");
          }

          let count = 0;

          for (const token of draft.refreshTokens) {
            if (
              where.userId !== undefined &&
              token.userId !== where.userId
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
      },
    };
  }

  const prisma = {
    passwordResetToken: {
      findUnique: async ({ where }) => {
        const token = state.tokens.find(
          (item) => item.tokenHash === where.tokenHash
        );

        return token ? { ...token } : null;
      },
    },

    $transaction: async (callback) => {
      const runTransaction = transactionQueue.then(async () => {
        const draft = {
          user: state.user ? { ...state.user } : null,
          tokens: state.tokens.map((token) => ({ ...token })),
          refreshTokens: state.refreshTokens.map((token) => ({
            ...token,
          })),
        };

        const result = await callback(createTransaction(draft));

        // Commit only when the transaction succeeds.
        state.user = draft.user;
        state.tokens = draft.tokens;
        state.refreshTokens = draft.refreshTokens;

        return result;
      });

      transactionQueue = runTransaction.catch(() => {});

      return runTransaction;
    },
  };

  return { prisma, state };
}

function createResetToken({
  id = "reset-1",
  userId = "user-1",
  token = validToken,
  expiresAt = new Date("2026-11-04T10:30:00.000Z"),
  usedAt = null,
  revokedAt = null,
} = {}) {
  return {
    id,
    userId,
    tokenHash: hashPasswordResetToken(token),
    expiresAt,
    usedAt,
    revokedAt,
  };
}

test("reset password updates the password and revokes active sessions", async () => {
  const { prisma, state } = createPrismaMock({
    tokens: [
      createResetToken(),
      createResetToken({
        id: "reset-2",
        token: "another-reset-token",
      }),
    ],
    refreshTokens: [
      {
        id: "refresh-1",
        userId: "user-1",
        revokedAt: null,
      },
      {
        id: "refresh-2",
        userId: "user-1",
        revokedAt: null,
      },
      {
        id: "refresh-3",
        userId: "another-user",
        revokedAt: null,
      },
      {
        id: "refresh-4",
        userId: "user-1",
        revokedAt: new Date("2026-11-03T10:00:00.000Z"),
      },
    ],
  });

  const result = await resetPassword(
    validToken,
    "NewSecurePassword123!",
    prisma,
    now
  );

  assert.equal(result, true);

  assert.notEqual(
    state.user.passwordHash,
    "old-password-hash"
  );

  assert.equal(
    await verifyPassword(
      state.user.passwordHash,
      "NewSecurePassword123!"
    ),
    true
  );

  assert.equal(
    await verifyPassword(
      state.user.passwordHash,
      "old-password"
    ),
    false
  );

  const consumedToken = state.tokens.find(
    (token) => token.id === "reset-1"
  );

  const otherResetToken = state.tokens.find(
    (token) => token.id === "reset-2"
  );

  assert.equal(consumedToken.usedAt.getTime(), now.getTime());
  assert.equal(otherResetToken.revokedAt.getTime(), now.getTime());

  const ownRefreshTokens = state.refreshTokens.filter(
    (token) => token.userId === "user-1"
  );

  assert.ok(
    ownRefreshTokens.every((token) => token.revokedAt instanceof Date)
  );

  const anotherUserToken = state.refreshTokens.find(
    (token) => token.id === "refresh-3"
  );

  assert.equal(anotherUserToken.revokedAt, null);
});

test("reset password rejects an unknown token", async () => {
  const { prisma, state } = createPrismaMock();

  const result = await resetPassword(
    "unknown-token",
    "NewSecurePassword123!",
    prisma,
    now
  );

  assert.equal(result, false);
  assert.equal(state.user.passwordHash, "old-password-hash");
});

test("reset password rejects an expired token", async () => {
  const { prisma, state } = createPrismaMock({
    tokens: [
      createResetToken({
        expiresAt: new Date("2026-11-04T09:59:59.000Z"),
      }),
    ],
  });

  const result = await resetPassword(
    validToken,
    "NewSecurePassword123!",
    prisma,
    now
  );

  assert.equal(result, false);
  assert.equal(state.user.passwordHash, "old-password-hash");
});

test("reset password rejects an already used token", async () => {
  const { prisma, state } = createPrismaMock({
    tokens: [
      createResetToken({
        usedAt: new Date("2026-11-04T09:00:00.000Z"),
      }),
    ],
  });

  const result = await resetPassword(
    validToken,
    "NewSecurePassword123!",
    prisma,
    now
  );

  assert.equal(result, false);
  assert.equal(state.user.passwordHash, "old-password-hash");
});

test("reset password rejects a revoked token", async () => {
  const { prisma, state } = createPrismaMock({
    tokens: [
      createResetToken({
        revokedAt: new Date("2026-11-04T09:00:00.000Z"),
      }),
    ],
  });

  const result = await resetPassword(
    validToken,
    "NewSecurePassword123!",
    prisma,
    now
  );

  assert.equal(result, false);
  assert.equal(state.user.passwordHash, "old-password-hash");
});

test("reset password cannot consume the same token twice", async () => {
  const { prisma, state } = createPrismaMock({
    tokens: [createResetToken()],
  });

  const firstResult = await resetPassword(
    validToken,
    "NewSecurePassword123!",
    prisma,
    now
  );

  const secondResult = await resetPassword(
    validToken,
    "AnotherSecurePassword456!",
    prisma,
    now
  );

  assert.equal(firstResult, true);
  assert.equal(secondResult, false);

  assert.equal(
    await verifyPassword(
      state.user.passwordHash,
      "NewSecurePassword123!"
    ),
    true
  );
});

test("reset password rolls back all changes when a database operation fails", async () => {
  const { prisma, state } = createPrismaMock({
    tokens: [createResetToken()],
    refreshTokens: [
      {
        id: "refresh-1",
        userId: "user-1",
        revokedAt: null,
      },
    ],
    failRefreshUpdate: true,
  });

  await assert.rejects(
    resetPassword(
      validToken,
      "NewSecurePassword123!",
      prisma,
      now
    ),
    /Simulated database failure/
  );

  assert.equal(state.user.passwordHash, "old-password-hash");
  assert.equal(state.tokens[0].usedAt, null);
  assert.equal(state.refreshTokens[0].revokedAt, null);
});
