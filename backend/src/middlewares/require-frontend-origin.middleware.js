
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const allowedOrigin = new URL(env.FRONTEND_URL).origin;

export function requireFrontendOrigin(req, res, next) {
  const origin = req.get("origin");

  if (!origin || origin !== allowedOrigin) {
    return next(
      new ApiError(403, "Request origin is not allowed.")
    );
  }

  return next();
}
