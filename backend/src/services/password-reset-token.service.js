
import {
  createHash,
  randomBytes,
} from "node:crypto";

export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 30 * 60;

const TOKEN_TTL_MS =
  PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000;

export function hashPasswordResetToken(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new TypeError("A valid reset token is required.");
  }

  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function createPasswordResetToken(now = new Date()) {
  // Generate a cryptographically secure random token.
  const token = randomBytes(32).toString("base64url");

  // Only the hash should be persisted in the database.
  const tokenHash = hashPasswordResetToken(token);

  // The token is valid for 30 minutes.
  const expiresAt = new Date(
    now.getTime() + TOKEN_TTL_MS
  );

  return {
    token,
    tokenHash,
    expiresAt,
  };
}
