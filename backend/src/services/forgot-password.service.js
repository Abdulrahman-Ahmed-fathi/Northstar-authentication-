
import {
  createPasswordResetToken,
} from "./password-reset-token.service.js";

export async function requestPasswordReset(
  email,
  prisma,
  sendEmail,
  now = new Date()
) {
  const normalizedEmail = email.trim().toLowerCase();

  // Find an eligible account and create its reset token.
  const prepared = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
      },
    });

    // Do not issue reset tokens for unknown or unverified accounts.
    if (!user || user.emailVerifiedAt === null) {
      return null;
    }

    // Revoke previous unused reset tokens.
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    const {
      token,
      tokenHash,
      expiresAt,
    } = createPasswordResetToken(now);

    const tokenRecord =
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
        select: {
          id: true,
        },
      });

    return {
      user: {
        name: user.name,
        email: user.email,
      },
      token,
      tokenRecordId: tokenRecord.id,
    };
  });

  // Unknown or unverified account: no email is sent.
  // The controller will return the same public response.
  if (!prepared) {
    return false;
  }

  try {
    await sendEmail({
      to: prepared.user.email,
      name: prepared.user.name,
      token: prepared.token,
    });

    return true;
  } catch {
    // Invalidate the token if the email could not be sent.
    try {
      await prisma.passwordResetToken.updateMany({
        where: {
          id: prepared.tokenRecordId,
          usedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } catch {
      console.error(
        "Failed to invalidate an undelivered password reset token."
      );
    }

    console.error("Password reset email delivery failed.");

    return false;
  }
}
