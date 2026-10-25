
import prisma from "../lib/prisma.js";

import { registerUser } from "../services/auth.service.js";
import { sendVerificationEmail } from "../services/email.service.js";
import { verifyEmailToken } from "../services/email-verification.service.js";
import { resendVerificationToken } from "../services/resend-verification.service.js";
import { loginUser } from "../services/login.service.js";

import {
  createAccessToken,
  ACCESS_TOKEN_TTL_SECONDS,
} from "../services/jwt.service.js";



import {
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../services/refresh-token.service.js";

import {
  REFRESH_TOKEN_COOKIE_NAME,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from "../utils/auth-cookies.js";

import { ApiError } from "../utils/ApiError.js";

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

export async function loginController(req, res, next) {
  try {
    // Verify the credentials and email-verification status.
    const user = await loginUser(req.body, prisma);

    // Issue a short-lived access token.
    const accessToken = await createAccessToken(user.id);

    // Create a persistent refresh-token record in the database.
    const refreshSession = await createRefreshToken(
      user.id,
      prisma
    );

    // Send the raw refresh token only through an HttpOnly cookie.
    setRefreshTokenCookie(res, refreshSession.refreshToken);

    return res.status(200).json({
      message: "Login successful.",
      data: {
        user,
        accessToken,
        tokenType: "Bearer",
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function refreshController(req, res, next) {
  try {
    const rawToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (!rawToken) {
      throw new ApiError(
        401,
        "Invalid or expired refresh token."
      );
    }

    // Consume the old token and create its replacement.
    const rotated = await rotateRefreshToken(rawToken, prisma);

    const user = await prisma.user.findUnique({
      where: { id: rotated.userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });

    if (!user || user.emailVerifiedAt === null) {
      await revokeRefreshToken(rotated.refreshToken, prisma);

      throw new ApiError(
        401,
        "Invalid or expired refresh token."
      );
    }

    let accessToken;

    try {
      accessToken = await createAccessToken(user.id);
    } catch (error) {
      // Do not leave a new active refresh token that was
      // never delivered to the client.
      await revokeRefreshToken(rotated.refreshToken, prisma);
      throw error;
    }

    setRefreshTokenCookie(res, rotated.refreshToken);

    return res.status(200).json({
      message: "Session refreshed.",
      data: {
        user,
        accessToken,
        tokenType: "Bearer",
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function logoutController(req, res, next) {
  try {
    const rawToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (rawToken) {
      await revokeRefreshToken(rawToken, prisma);
    }

    clearRefreshTokenCookie(res);

    return res.status(200).json({
      message: "Logout successful.",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getMeController(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.auth.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ApiError(401, "Authentication required.");
    }

    return res.status(200).json({
      message: "User retrieved successfully.",
      data: {
        user,
      },
    });
  } catch (error) {
    return next(error);
  }
}