
import { verifyAccessToken } from "../services/jwt.service.js";
import { ApiError } from "../utils/ApiError.js";

export async function authenticate(req, res, next) {
  const authorization = req.get("authorization");

  const match =
    typeof authorization === "string"
      ? authorization.match(/^Bearer\s+(\S+)$/i)
      : null;

  if (!match) {
    return next(
      new ApiError(401, "Authentication required.")
    );
  }

  const token = match[1];

  let payload;

  try {
    payload = await verifyAccessToken(token);
  } catch {
    return next(
      new ApiError(401, "Invalid or expired access token.")
    );
  }

  if (
    typeof payload.sub !== "string" ||
    payload.sub.trim().length === 0
  ) {
    return next(
      new ApiError(401, "Invalid or expired access token.")
    );
  }

  req.auth = {
    userId: payload.sub,
  };

  return next();
}
