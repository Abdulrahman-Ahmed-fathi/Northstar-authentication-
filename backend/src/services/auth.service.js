
import { hashPassword } from "./password.service.js";
import {
  createEmailVerificationToken,
} from "./email-verification-token.service.js";
import { ApiError } from "../utils/ApiError.js";

export async function registerUser(input, prisma) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  const passwordHash = await hashPassword(input.password);

  const {
    token,
    tokenHash,
    expiresAt,
  } = createEmailVerificationToken();

  try {
    // Create the user and verification token in one transaction.
    const result = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      });

      const verificationRecord =
        await tx.emailVerificationToken.create({
          data: {
            userId: createdUser.id,
            tokenHash,
            expiresAt,
          },
          select: {
            id: true,
          },
        });

      return {
        user: createdUser,
        verificationTokenRecordId: verificationRecord.id,
      };
    });

    // Return the raw token only for email delivery.
    // Never include it in the public API response.
    return {
      user: result.user,
      verificationToken: token,
      verificationTokenRecordId:
        result.verificationTokenRecordId,
    };
  } catch (error) {
    const target = error?.meta?.target;

    const emailConflict = Array.isArray(target)
      ? target.includes("email")
      : typeof target === "string" &&
        target.toLowerCase().includes("email");

    if (error?.code === "P2002" && emailConflict) {
      throw new ApiError(
        409,
        "An account with this email already exists."
      );
    }

    throw error;
  }
}
