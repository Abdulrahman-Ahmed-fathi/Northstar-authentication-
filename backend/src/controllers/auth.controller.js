
import prisma from "../lib/prisma.js";

import { registerUser } from "../services/auth.service.js";
import { sendVerificationEmail } from "../services/email.service.js";
import { verifyEmailToken } from "../services/email-verification.service.js";
import { resendVerificationToken } from "../services/resend-verification.service.js";

export async function registerController(req, res, next) {
  try {
    const {
      user,
      verificationToken,
      verificationTokenRecordId,
    } = await registerUser(req.body, prisma);

    try {
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        token: verificationToken,
      });
    } catch {
      // Invalidate the token if its email could not be sent.
      if (verificationTokenRecordId) {
        try {
          await prisma.emailVerificationToken.updateMany({
            where: {
              id: verificationTokenRecordId,
              usedAt: null,
              revokedAt: null,
            },
            data: {
              revokedAt: new Date(),
            },
          });
        } catch {
          console.error(
            "Failed to invalidate an undelivered registration token."
          );
        }
      }

      // Do not log the token, email address, or verification URL.
      console.error("Verification email delivery failed.");

      return res.status(201).json({
        message:
          "Account created, but the verification email could not be sent.",
        data: {
          user,
          emailVerified: false,
          verificationEmailSent: false,
        },
      });
    }

    return res.status(201).json({
      message:
        "Account created. Please check your email to verify your account.",
      data: {
        user,
        emailVerified: false,
        verificationEmailSent: true,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function verifyEmailController(req, res, next) {
  try {
    const result = await verifyEmailToken(
      req.body.token,
      prisma
    );

    return res.status(200).json({
      message: result.alreadyVerified
        ? "Email address is already verified."
        : "Email address verified successfully.",
      data: {
        emailVerified: true,
        alreadyVerified: result.alreadyVerified,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function resendVerificationController(req, res, next) {
  try {
    await resendVerificationToken(
      req.body.email,
      prisma,
      sendVerificationEmail
    );

    return res.status(200).json({
      message:
        "If an unverified account exists for this email, a verification email will be sent if eligible.",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}
