
import {
  createEmailVerificationToken,
} from "./email-verification-token.service.js";

export async function resendVerificationToken(
  email,
  prisma,
  sendEmail,
  now = new Date()
) {
  const prepared = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
      },
    });

    // Do nothing if the account does not exist or is
    // already verified. The public response stays identical.
    if (!user || user.emailVerifiedAt !== null) {
      return null;
    }

    // Revoke all previously unused verification tokens.
    await tx.emailVerificationToken.updateMany({
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
    } = createEmailVerificationToken(now);

    const tokenRecord = await tx.emailVerificationToken.create({
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
    // If delivery fails, invalidate the new token because
    // the user has not received its link.
    try {
      await prisma.emailVerificationToken.updateMany({
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
        "Failed to invalidate an undelivered verification token."
      );
    }

    // Never log the token, URL, email, or provider response.
    console.error("Verification email resend failed.");

    return false;
  }
}
