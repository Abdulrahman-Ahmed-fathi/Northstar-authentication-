
import test from "node:test";
import assert from "node:assert/strict";

import {
  hashEmailVerificationToken,
} from "../services/email-verification-token.service.js";

import {
  verifyEmailToken,
} from "../services/email-verification.service.js";

import { ApiError } from "../utils/ApiError.js";

const rawToken = "verification-token-for-tests";
const now = new Date("2026-01-01T00:00:00.000Z");

function createPrismaMock({
  expiresAt = new Date("2026-01-02T00:00:00.000Z"),
  usedAt = null,
  revokedAt = null,
  emailVerifiedAt = null,
  tokenExists = true,
} = {}) {
  const state = {
    token: tokenExists
      ? {
          id: "token-1",
          userId: "user-1",
          tokenHash: hashEmailVerificationToken(rawToken),
          expiresAt,
          usedAt,
          revokedAt,
        }
      : null,

    user: {
      id: "user-1",
      emailVerifiedAt,
    },
  };

  const tx = {
    emailVerificationToken: {
      findUnique: async ({ where }) => {
        if (
          !state.token ||
          state.token.tokenHash !== where.tokenHash
        ) {
          return null;
        }

        return {
          ...state.token,
          user: {
            emailVerifiedAt: state.user.emailVerifiedAt,
          },
        };
      },

      updateMany: async ({ where, data }) => {
        const record = state.token;

        if (
          !record ||
          record.id !== where.id ||
          record.usedAt !== where.usedAt ||
          record.revokedAt !== where.revokedAt ||
          record.expiresAt.getTime() <=
            where.expiresAt.gt.getTime()
        ) {
          return { count: 0 };
        }

        record.usedAt = data.usedAt;
        return { count: 1 };
      },
    },

    user: {
      updateMany: async ({ where, data }) => {
        if (
          state.user.id !== where.id ||
          state.user.emailVerifiedAt !== where.emailVerifiedAt
        ) {
          return { count: 0 };
        }

        state.user.emailVerifiedAt = data.emailVerifiedAt;
        return { count: 1 };
      },

      findUnique: async ({ where }) => {
        if (state.user.id !== where.id) {
          return null;
        }

        return { ...state.user };
      },
    },
  };

  return {
    state,
    client: {
      $transaction: async (callback) => callback(tx),
    },
  };
}

test("verification marks the email as verified and consumes the token", async () => {
  const mock = createPrismaMock();

  const result = await verifyEmailToken(
    rawToken,
    mock.client,
    now
  );

  assert.deepEqual(result, { alreadyVerified: false });
  assert.equal(
    mock.state.user.emailVerifiedAt.toISOString(),
    now.toISOString()
  );
  assert.equal(
    mock.state.token.usedAt.toISOString(),
    now.toISOString()
  );
});

test("an expired token is rejected", async () => {
  const mock = createPrismaMock({
    expiresAt: new Date("2025-12-31T23:59:59.000Z"),
  });

  await assert.rejects(
    () => verifyEmailToken(rawToken, mock.client, now),
    (error) =>
      error instanceof ApiError &&
      error.statusCode === 400
  );

  assert.equal(mock.state.user.emailVerifiedAt, null);
});

test("a token cannot be used twice", async () => {
  const mock = createPrismaMock();

  await verifyEmailToken(rawToken, mock.client, now);

  await assert.rejects(
    () => verifyEmailToken(rawToken, mock.client, now),
    (error) =>
      error instanceof ApiError &&
      error.statusCode === 400
  );
});

test("an unknown token is rejected", async () => {
  const mock = createPrismaMock({ tokenExists: false });

  await assert.rejects(
    () =>
      verifyEmailToken(
        "unknown-token",
        mock.client,
        now
      ),
    (error) =>
      error instanceof ApiError &&
      error.statusCode === 400
  );
});
