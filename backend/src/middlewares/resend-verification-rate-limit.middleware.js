
import { createHash } from "node:crypto";
import { rateLimit } from "express-rate-limit";

function rateLimitResponse(_req, res) {
  return res.status(429).json({
    message: "Too many verification requests. Please try again later.",
    data: null,
  });
}

// Limit all requests from a single IP.
export const resendVerificationIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitResponse,
});

// Limit requests for each normalized email without storing
// the raw email address in the rate limiter's key.
export const resendVerificationEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  keyGenerator: (req) =>
    createHash("sha256")
      .update(req.body.email)
      .digest("hex"),

  handler: rateLimitResponse,
});
