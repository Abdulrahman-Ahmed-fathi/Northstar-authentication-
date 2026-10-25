
import { rateLimit } from "express-rate-limit";

export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  handler(_req, res) {
    return res.status(429).json({
      message: "Too many refresh requests. Please try again later.",
      data: null,
    });
  },
});
