
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  createEmailVerificationToken,
} from "../services/email-verification-token.service.js";

test("email verification tokens are secure, hashed, and expire after 24 hours", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  const result = createEmailVerificationToken(now);

  assert.equal(typeof result.token, "string");
  assert.equal(result.token.length, 43);

  assert.equal(
    result.tokenHash,
    createHash("sha256").update(result.token).digest("hex")
  );

  assert.notEqual(result.token, result.tokenHash);

  assert.equal(
    result.expiresAt.toISOString(),
    "2026-01-02T00:00:00.000Z"
  );
});

test("each generated email verification token is unique", () => {
  const first = createEmailVerificationToken();
  const second = createEmailVerificationToken();

  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
});
