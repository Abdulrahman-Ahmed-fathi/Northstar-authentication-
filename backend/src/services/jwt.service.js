
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

// Decode the locally generated 32-byte Base64URL secret.
const secret = Buffer.from(
  env.JWT_ACCESS_SECRET,
  "base64url"
);

const ISSUER = "northstar-auth";
const AUDIENCE = "northstar-api";
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export async function createAccessToken(userId) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("A valid user ID is required.");
  }

  return new SignJWT({})
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(token) {
  if (typeof token !== "string" || !token) {
    throw new TypeError("A JWT is required.");
  }

  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  return payload;
}
