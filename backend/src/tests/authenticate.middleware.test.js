
import test from "node:test";
import assert from "node:assert/strict";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { createAccessToken } from "../services/jwt.service.js";
import { ApiError } from "../utils/ApiError.js";

test("authenticate accepts a valid access token", async () => {
  const userId = "user-123";
  const token = await createAccessToken(userId);

  const req = {
    get: (name) =>
      name === "authorization"
        ? `Bearer ${token}`
        : undefined,
  };

  let nextError;
  let nextCalled = false;

  await authenticate(req, {}, (error) => {
    nextCalled = true;
    nextError = error;
  });

  assert.equal(nextCalled, true);
  assert.equal(nextError, undefined);
  assert.equal(req.auth.userId, userId);
});

test("authenticate rejects a missing authorization header", async () => {
  const req = {
    get: () => undefined,
  };

  let nextError;

  await authenticate(req, {}, (error) => {
    nextError = error;
  });

  assert.ok(nextError instanceof ApiError);
  assert.equal(nextError.statusCode, 401);
});

test("authenticate rejects a malformed access token", async () => {
  const req = {
    get: (name) =>
      name === "authorization"
        ? "Bearer not-a-valid-jwt"
        : undefined,
  };

  let nextError;

  await authenticate(req, {}, (error) => {
    nextError = error;
  });

  assert.ok(nextError instanceof ApiError);
  assert.equal(nextError.statusCode, 401);
});
