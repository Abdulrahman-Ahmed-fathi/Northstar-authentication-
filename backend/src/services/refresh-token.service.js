
import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { ApiError } from "../utils/ApiError.js";

export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const REFRESH_TOKEN_TTL_MS =
  REFRESH_TOKEN_TTL_SECONDS * 1000;

function invalidRefreshTokenError() {
  return new ApiError(
    401,
    "Invalid or expired refresh token."
  );
}

export function hashRefreshToken(token) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function generateRefreshToken(now) {
  const refreshToken = randomBytes(32).toString("base64url");

  return {
    refreshToken,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(
      now.getTime() + REFRESH_TOKEN_TTL_MS
    ),
  };
}

export async function createRefreshToken(
  userId,
  prisma,
  { familyId = randomUUID(), now = new Date() } = {}
) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("A valid user ID is required.");
  }

  const generated = generateRefreshToken(now);

  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: generated.tokenHash,
      expiresAt: generated.expiresAt,
    },
  });

  // Return the raw token only to the server-side caller.
  // Never store it in the database or log it.
  return {
    refreshToken: generated.refreshToken,
    familyId,
    expiresAt: generated.expiresAt,
  };
}

export async function rotateRefreshToken(
  rawToken,
  prisma,
  now = new Date()
) {
  if (typeof rawToken !== "string" || !rawToken) {
    throw invalidRefreshTokenError();
  }

  const tokenHash = hashRefreshToken(rawToken);

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      familyId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!existing) {
    throw invalidRefreshTokenError();
  }

  // Reuse of a revoked token indicates possible replay.
  // Commit family revocation before throwing the error.
  if (existing.revokedAt !== null) {
    await prisma.refreshToken.updateMany({
      where: {
        familyId: existing.familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    throw invalidRefreshTokenError();
  }

  if (existing.expiresAt.getTime() <= now.getTime()) {
    throw invalidRefreshTokenError();
  }

  const next = generateRefreshToken(now);

  // Claim the current token and create its replacement
  // atomically. If creation fails, the transaction rolls back.
  const rotation = await prisma.$transaction(async (tx) => {
    const claimed = await tx.refreshToken.updateMany({
      where: {
        id: existing.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        revokedAt: now,
      },
    });

    if (claimed.count !== 1) {
      return { status: "replay" };
    }

    await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        familyId: existing.familyId,
        tokenHash: next.tokenHash,
        expiresAt: next.expiresAt,
      },
    });

    return { status: "rotated" };
  });

  if (rotation.status === "replay") {
    // Another request may have consumed this token first.
    // Invalidate the remaining active tokens in its family.
    await prisma.refreshToken.updateMany({
      where: {
        familyId: existing.familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    throw invalidRefreshTokenError();
  }

  return {
    refreshToken: next.refreshToken,
    familyId: existing.familyId,
    expiresAt: next.expiresAt,
    userId: existing.userId,
  };
}



export async function revokeRefreshToken(
  rawToken,
  prisma,
  now = new Date()
) {
  if (typeof rawToken !== "string" || !rawToken) {
    return;
  }

  const tokenHash = hashRefreshToken(rawToken);

  // Revoke only the matching active token.
  // Repeated logout requests are safe and idempotent.
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
    },
  });
}
