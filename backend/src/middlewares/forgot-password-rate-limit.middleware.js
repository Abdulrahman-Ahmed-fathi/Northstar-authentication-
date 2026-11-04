
import { rateLimit } from "express-rate-limit";

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  handler(_req, res) {
    return res.status(429).json({
      message: "Too many password reset requests. Please try again later.",
      data: null,
    });
  },
});
