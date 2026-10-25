
import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../utils/ApiError.js";

import {
  createRefreshToken,
  hashRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  REFRESH_TOKEN_TTL_SECONDS,
} from "../services/refresh-token.service.js";




function createPrismaMock(initialTokens = []) {
  const state = {
    tokens: initialTokens.map((token) => ({ ...token })),
  };

  const refreshToken = {
    create: async ({ data }) => {
      const record = {
        id: `refresh-${state.tokens.length + 1}`,
        createdAt: new Date(),
        revokedAt: null,
        ...data,
      };

      state.tokens.push(record);

      return { id: record.id };
    },

    findUnique: async ({ where }) => {
      const record = state.tokens.find(
        (token) => token.tokenHash === where.tokenHash
      );

      return record ? { ...record } : null;
    },

    updateMany: async ({ where, data }) => {
      let count = 0;

      for (const token of state.tokens) {
        // Match by record ID when provided.
        if (
          where.id !== undefined &&
          token.id !== where.id
        ) {
          continue;
        }

        // Match by token hash when provided.
        if (
          where.tokenHash !== undefined &&
          token.tokenHash !== where.tokenHash
        ) {
          continue;
        }

        // Match by token family when provided.
        if (
          where.familyId !== undefined &&
          token.familyId !== where.familyId
        ) {
          continue;
        }

        // Match the current revocation state when provided.
        if (
          where.revokedAt !== undefined &&
          token.revokedAt !== where.revokedAt
        ) {
          continue;
        }

        // Ignore expired tokens when a later expiry is required.
        if (
          where.expiresAt?.gt &&
          token.expiresAt.getTime() <=
            where.expiresAt.gt.getTime()
        ) {
          continue;
        }

        Object.assign(token, data);
        count += 1;
      }

      return { count };
    },
  };

  const prisma = {
    refreshToken,

    $transaction: async (callback) =>
      callback({ refreshToken }),
  };

  return { prisma, state };
}


const now = new Date("2026-01-01T00:00:00.000Z");

test("refresh token creation stores only its hash", async () => {
  const { prisma, state } = createPrismaMock();

  const result = await createRefreshToken(
    "user-1",
    prisma,
    { now }
  );

  const stored = state.tokens[0];

  assert.equal(result.refreshToken.length, 43);
  assert.notEqual(result.refreshToken, stored.tokenHash);

  assert.equal(
    stored.tokenHash,
    hashRefreshToken(result.refreshToken)
  );

  assert.equal(stored.userId, "user-1");
  assert.equal(stored.familyId, result.familyId);

  assert.match(
    result.familyId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );

  assert.equal(
    result.expiresAt.getTime() - now.getTime(),
    REFRESH_TOKEN_TTL_SECONDS * 1000
  );
});

test("rotation revokes the old token and creates a replacement in the same family", async () => {
  const { prisma, state } = createPrismaMock();

  const first = await createRefreshToken(
    "user-1",
    prisma,
    { now }
  );

  const rotatedAt = new Date(now.getTime() + 1000);

  const second = await rotateRefreshToken(
    first.refreshToken,
    prisma,
    rotatedAt
  );

  assert.notEqual(second.refreshToken, first.refreshToken);
  assert.equal(second.familyId, first.familyId);
  assert.equal(second.userId, "user-1");

  assert.equal(state.tokens.length, 2);
  assert.equal(
    state.tokens[0].revokedAt.getTime(),
    rotatedAt.getTime()
  );

  assert.equal(state.tokens[1].revokedAt, null);
  assert.equal(
    state.tokens[1].tokenHash,
    hashRefreshToken(second.refreshToken)
  );
});

test("an unknown refresh token is rejected", async () => {
  const { prisma } = createPrismaMock();

  await assert.rejects(
    () => rotateRefreshToken("unknown-token", prisma, now),
    (error) =>
      error instanceof ApiError &&
      error.statusCode === 401
  );
});

test("an expired refresh token is rejected", async () => {
  const rawToken = "expired-refresh-token";
  const familyId = "11111111-1111-4111-8111-111111111111";

  const { prisma, state } = createPrismaMock([
    {
      id: "expired-1",
      userId: "user-1",
      familyId,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(now.getTime() - 1000),
      revokedAt: null,
    },
  ]);

  await assert.rejects(
    () => rotateRefreshToken(rawToken, prisma, now),
    (error) =>
      error instanceof ApiError &&
      error.statusCode === 401
  );

  assert.equal(state.tokens.length, 1);
});

test("reusing a revoked token revokes the remaining active family tokens", async () => {
  const { prisma, state } = createPrismaMock();

  const first = await createRefreshToken(
    "user-1",
    prisma,
    { now }
  );

  const rotatedAt = new Date(now.getTime() + 1000);

  const second = await rotateRefreshToken(
    first.refreshToken,
    prisma,
    rotatedAt
  );

  await assert.rejects(
    () =>
      rotateRefreshToken(
        first.refreshToken,
        prisma,
        new Date(now.getTime() + 2000)
      ),
    (error) =>
      error instanceof ApiError &&
      error.statusCode === 401
  );

  assert.ok(state.tokens.every(
    (token) => token.revokedAt instanceof Date
  ));
});


test("logout revokes only the matching refresh token", async () => {
  const { prisma, state } = createPrismaMock();

  const first = await createRefreshToken(
    "user-1",
    prisma,
    { now }
  );

  const second = await createRefreshToken(
    "user-1",
    prisma,
    { now }
  );

  await revokeRefreshToken(first.refreshToken, prisma, now);

  assert.ok(state.tokens[0].revokedAt instanceof Date);
  assert.equal(state.tokens[1].revokedAt, null);

  // Repeated revocation is safe.
  await revokeRefreshToken(first.refreshToken, prisma, now);

  assert.ok(state.tokens[0].revokedAt instanceof Date);
  assert.equal(state.tokens[1].revokedAt, null);
});

test("revoking an unknown refresh token is safe", async () => {
  const { prisma, state } = createPrismaMock();

  await revokeRefreshToken("unknown-token", prisma, now);

  assert.equal(state.tokens.length, 0);
});
