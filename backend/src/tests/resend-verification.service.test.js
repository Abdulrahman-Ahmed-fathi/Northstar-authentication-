
import test from "node:test";
import assert from "node:assert/strict";

import {
  resendVerificationToken,
} from "../services/resend-verification.service.js";

import {
  hashEmailVerificationToken,
} from "../services/email-verification-token.service.js";

function createPrismaMock({ user, initialTokens = [] }) {
  const state = {
    user: user ? { ...user } : null,
    tokens: initialTokens.map((token) => ({ ...token })),
  };

  function matches(token, where) {
    if (where.id !== undefined && token.id !== where.id) {
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
      where.expiresAt?.gt &&
      token.expiresAt <= where.expiresAt.gt
    ) {
      return false;
    }

    return true;
  }

  const emailVerificationToken = {
    updateMany: async ({ where, data }) => {
      let count = 0;

      for (const token of state.tokens) {
        if (matches(token, where)) {
          Object.assign(token, data);
          count += 1;
        }
      }

      return { count };
    },

    create: async ({ data }) => {
      const record = {
        id: `token-${state.tokens.length + 1}`,
        ...data,
        usedAt: null,
        revokedAt: null,
      };

      state.tokens.push(record);

      return { id: record.id };
    },
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

    emailVerificationToken,
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
    emailVerificationToken,
  };

  return { prisma, state };
}

const testUser = {
  id: "user-1",
  name: "Northstar Test",
  email: "test@example.com",
  emailVerifiedAt: null,
};

const now = new Date("2026-10-24T12:00:00.000Z");

test("resend creates a new token, revokes old tokens, and sends email", async () => {
  const { prisma, state } = createPrismaMock({
    user: testUser,
    initialTokens: [
      {
        id: "old-token",
        userId: "user-1",
        tokenHash: "old-hash",
        expiresAt: new Date("2026-10-25T12:00:00.000Z"),
        usedAt: null,
        revokedAt: null,
      },
      {
        id: "used-token",
        userId: "user-1",
        tokenHash: "used-hash",
        expiresAt: new Date("2026-10-25T12:00:00.000Z"),
        usedAt: new Date("2026-10-23T12:00:00.000Z"),
        revokedAt: null,
      },
    ],
  });

  let sentEmail;

  const sendEmail = async (input) => {
    sentEmail = input;
  };

  const result = await resendVerificationToken(
    testUser.email,
    prisma,
    sendEmail,
    now
  );

  assert.equal(result, true);
  assert.equal(sentEmail.to, testUser.email);
  assert.equal(sentEmail.name, testUser.name);

  const oldToken = state.tokens.find(
    (token) => token.id === "old-token"
  );

  const usedToken = state.tokens.find(
    (token) => token.id === "used-token"
  );

  const newToken = state.tokens.find(
    (token) => token.id === "token-3"
  );

  assert.equal(oldToken.revokedAt.getTime(), now.getTime());
  assert.equal(usedToken.revokedAt, null);

  assert.ok(newToken);
  assert.equal(
    newToken.tokenHash,
    hashEmailVerificationToken(sentEmail.token)
  );

  assert.notEqual(newToken.tokenHash, sentEmail.token);
  assert.equal(
    newToken.expiresAt.toISOString(),
    "2026-10-25T12:00:00.000Z"
  );
});

test("resend does not send email for an unknown account", async () => {
  const { prisma, state } = createPrismaMock({
    user: null,
  });

  let sendCount = 0;

  const result = await resendVerificationToken(
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

test("resend does not issue a token for a verified account", async () => {
  const { prisma, state } = createPrismaMock({
    user: {
      ...testUser,
      emailVerifiedAt: new Date("2026-10-20T12:00:00.000Z"),
    },
  });

  let sendCount = 0;

  const result = await resendVerificationToken(
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

test("resend revokes the newly created token when email delivery fails", async () => {
  const { prisma, state } = createPrismaMock({
    user: testUser,
  });

  const result = await resendVerificationToken(
    testUser.email,
    prisma,
    async () => {
      throw new Error("Simulated provider failure");
    },
    now
  );

  assert.equal(result, false);
  assert.equal(state.tokens.length, 1);
  assert.ok(state.tokens[0].revokedAt instanceof Date);
});
