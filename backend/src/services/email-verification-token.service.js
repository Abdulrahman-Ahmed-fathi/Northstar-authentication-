
import { createHash, randomBytes } from "node:crypto";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function hashEmailVerificationToken(token) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function createEmailVerificationToken(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashEmailVerificationToken(token);

  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  return {
    token,
    tokenHash,
    expiresAt,
  };
}
