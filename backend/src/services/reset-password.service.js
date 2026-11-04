
import {
  hashPasswordResetToken,
} from "./password-reset-token.service.js";

import {
  hashPassword,
} from "./password.service.js";

export async function resetPassword(
  token,
  newPassword,
  prisma,
  now = new Date()
) {
  // 1. Hash the incoming reset token.
  const tokenHash = hashPasswordResetToken(token);

  // 2. Find the corresponding reset token.
  const existingToken =
    await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
      },
    });

  // 3. Reject invalid, expired, used, or revoked tokens.
  if (
    !existingToken ||
    existingToken.usedAt !== null ||
    existingToken.revokedAt !== null ||
    existingToken.expiresAt <= now
  ) {
    return false;
  }

  // 4. Hash the new password before opening the transaction.
  const passwordHash = await hashPassword(newPassword);

  // 5. Apply all database changes atomically.
  return prisma.$transaction(async (tx) => {
    // Claim the reset token.
    // The conditions protect against concurrent requests.
    const claimedToken =
      await tx.passwordResetToken.updateMany({
        where: {
          id: existingToken.id,
          userId: existingToken.userId,
          usedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
        },
      });

    // Another request may have already consumed or revoked it.
    if (claimedToken.count !== 1) {
      return false;
    }

    // Update the user's password.
    await tx.user.update({
      where: {
        id: existingToken.userId,
      },
      data: {
        passwordHash,
      },
    });

    // Revoke all non-revoked refresh tokens.
    await tx.refreshToken.updateMany({
      where: {
        userId: existingToken.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    // Revoke any other unused password reset tokens.
    await tx.passwordResetToken.updateMany({
      where: {
        userId: existingToken.userId,
        id: {
          not: existingToken.id,
        },
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    return true;
  });
}
