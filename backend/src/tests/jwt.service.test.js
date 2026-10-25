
import test from "node:test";
import assert from "node:assert/strict";

import {
  createAccessToken,
  verifyAccessToken,
} from "../services/jwt.service.js";

test("access token can be created and verified", async () => {
  const userId = "user-123";

  const token = await createAccessToken(userId);
  const payload = await verifyAccessToken(token);

  assert.equal(typeof token, "string");
  assert.equal(payload.sub, userId);
  assert.equal(payload.iss, "northstar-auth");
  assert.equal(payload.aud, "northstar-api");

  assert.equal(typeof payload.iat, "number");
  assert.equal(typeof payload.exp, "number");
  assert.ok(payload.exp > payload.iat);

  // Keep the payload minimal.
  assert.equal(payload.email, undefined);
  assert.equal(payload.password, undefined);
});

test("verification rejects a malformed token", async () => {
  await assert.rejects(
    () => verifyAccessToken("not-a-valid-jwt"),
  );
});

test("verification rejects a token with a modified payload", async () => {
  const token = await createAccessToken("user-123");
  const [header, payload] = token.split(".");

  const modifiedPayload = Buffer.from(
    JSON.stringify({
      sub: "attacker-user",
      iss: "northstar-auth",
      aud: "northstar-api",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    })
  ).toString("base64url");

  const tamperedToken =
    `${header}.${modifiedPayload}.${token.split(".")[2]}`;

  await assert.rejects(
    () => verifyAccessToken(tamperedToken),
  );
});

test("creating an access token rejects an empty user ID", async () => {
  await assert.rejects(
    () => createAccessToken(""),
    TypeError,
  );
});
