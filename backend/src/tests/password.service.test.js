
import test from "node:test";
import assert from "node:assert/strict";

import {
  hashPassword,
  verifyPassword,
} from "../services/password.service.js";

test("password hashing and verification work correctly", async () => {
  const password = "correct horse battery staple";

  const passwordHash = await hashPassword(password);

  assert.notEqual(passwordHash, password);
  assert.match(passwordHash, /^\$argon2id\$/);

  assert.equal(
    await verifyPassword(passwordHash, password),
    true
  );

  assert.equal(
    await verifyPassword(passwordHash, "incorrect password"),
    false
  );
});
