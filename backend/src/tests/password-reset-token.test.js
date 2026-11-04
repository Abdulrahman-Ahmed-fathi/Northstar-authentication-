
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  createPasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
} from "../services/password-reset-token.service.js";

test("password reset tokens are hashed and expire after 30 minutes", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  const result = createPasswordResetToken(now);

  assert.equal(typeof result.token, "string");
  assert.equal(result.token.length, 43);

  assert.equal(
    result.tokenHash,
    createHash("sha256")
      .update(result.token)
      .digest("hex")
  );

  assert.equal(
    result.tokenHash,
    hashPasswordResetToken(result.token)
  );

  assert.notEqual(result.token, result.tokenHash);

  assert.match(result.tokenHash, /^[a-f0-9]{64}$/);

  assert.equal(
    result.expiresAt.toISOString(),
    "2026-01-01T00:30:00.000Z"
  );

  assert.equal(PASSWORD_RESET_TOKEN_TTL_SECONDS, 1800);
});

test("each password reset token is unique", () => {
  const first = createPasswordResetToken();
  const second = createPasswordResetToken();

  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
});

test("hashing an empty reset token is rejected", () => {
  assert.throws(
    () => hashPasswordResetToken(""),
    TypeError
  );
});
