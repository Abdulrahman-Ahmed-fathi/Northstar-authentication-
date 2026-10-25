
import { randomBytes } from "node:crypto";

import {
  hashPassword,
  verifyPassword,
} from "./password.service.js";

import { ApiError } from "../utils/ApiError.js";

// Used to perform a password verification even when the
// requested account does not exist.
let dummyPasswordHashPromise;

function getDummyPasswordHash() {
  if (!dummyPasswordHashPromise) {
    const randomPassword = randomBytes(32).toString("base64url");

    dummyPasswordHashPromise = hashPassword(randomPassword);
  }

  return dummyPasswordHashPromise;
}

export async function loginUser(input, prisma) {
  const email = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  });

  // Use a dummy Argon2 hash for unknown accounts to reduce
  // timing differences between existing and missing accounts.
  const passwordHash = user
    ? user.passwordHash
    : await getDummyPasswordHash();

  const passwordMatches = await verifyPassword(
    passwordHash,
    input.password
  );

  // Do not reveal whether the email or password was incorrect.
  if (!user || !passwordMatches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  // Require email verification before allowing authentication.
  if (user.emailVerifiedAt === null) {
    throw new ApiError(
      403,
      "Email address must be verified before signing in."
    );
  }

  // Never return the password hash to the caller.
  const {
    passwordHash: _passwordHash,
    ...safeUser
  } = user;

  return safeUser;
}
