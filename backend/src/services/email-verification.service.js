
import {
  hashEmailVerificationToken,
} from "./email-verification-token.service.js";
import { ApiError } from "../utils/ApiError.js";

function invalidTokenError() {
  return new ApiError(
    400,
    "Verification token is invalid, expired, or already used."
  );
}

export async function verifyEmailToken(
  token,
  prisma,
  now = new Date()
) {
  const tokenHash = hashEmailVerificationToken(token);

  return prisma.$transaction(async (tx) => {
    const record = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
        user: {
          select: {
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (
      !record ||
      record.usedAt !== null ||
      record.revokedAt !== null ||
      record.expiresAt.getTime() <= now.getTime()
    ) {
      throw invalidTokenError();
    }

    // Claim the token atomically so it cannot be consumed twice.
    const claimed = await tx.emailVerificationToken.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        usedAt: now,
      },
    });

    if (claimed.count !== 1) {
      throw invalidTokenError();
    }

    // Consume a valid token without changing an existing
    // verification timestamp.
    if (record.user.emailVerifiedAt !== null) {
      return { alreadyVerified: true };
    }

    const updated = await tx.user.updateMany({
      where: {
        id: record.userId,
        emailVerifiedAt: null,
      },
      data: {
        emailVerifiedAt: now,
      },
    });

    if (updated.count === 1) {
      return { alreadyVerified: false };
    }

    // Another valid token may have verified the same account
    // concurrently. Check the final state before responding.
    const currentUser = await tx.user.findUnique({
      where: { id: record.userId },
      select: { emailVerifiedAt: true },
    });

    if (!currentUser) {
      throw invalidTokenError();
    }

    return {
      alreadyVerified: currentUser.emailVerifiedAt !== null,
    };
  });
}
