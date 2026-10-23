# API Contract — Northstar Authentication System

**Version:** 0.1  
**Status:** Initial Draft  
**Base Path:** `/api/v1`  
**Backend:** Node.js + Express.js  
**Database:** NeonDB PostgreSQL via Prisma  
**Authentication:** JWT Access Token + Refresh Token Cookie

## 1. Purpose

This document defines the HTTP API contract between the Next.js frontend and the Express.js backend.

It specifies:
- Available endpoints.
- HTTP methods and paths.
- Request headers and request bodies.
- Successful response formats.
- Error response formats.
- HTTP status codes.
- Authentication requirements.
- Cookie behavior.
- Validation rules relevant to API consumers.

The implementation must follow this contract. If a contract change becomes necessary, update this document before or alongside the implementation.

## 2. API Conventions

### 2.1 Base URL

Local development:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000/api/v1`

The base URL must be configurable through environment variables.

Frontend configuration:

`NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1`

Database credentials and JWT signing secrets must never use `NEXT_PUBLIC_*` environment variables.

### 2.2 Request Format

Requests containing a JSON body must use:

`Content-Type: application/json`

JSON field names use `camelCase`.

Email addresses shall be trimmed and normalized to lowercase for account lookup and uniqueness checks. Passwords must not be silently trimmed or otherwise modified.

### 2.3 Success Response Format

Successful responses containing a body shall follow this general format:

```json
{
  "message": "Operation completed successfully",
  "data": {}
}
```

The `message` is intended for general feedback. The `data` object contains the operation's result.

A `204 No Content` response has no response body.

### 2.4 Error Response Format

Error responses shall follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Enter a valid email address"
      }
    ]
  }
}
```

The `details` property is optional and may contain field-level validation errors.

The frontend should use `error.code` for predictable error handling and display appropriate user-facing messages.

Raw stack traces, database errors, passwords, and authentication secrets must never be exposed in public error responses.

## 3. Common HTTP Status Codes

| Status | Meaning | Typical Use |
|---|---|---|
| `200 OK` | Request succeeded | Login, verification, reset password, refresh, current user |
| `201 Created` | Resource created | Successful registration |
| `202 Accepted` | Request accepted for processing | Forgot-password and resend-verification |
| `204 No Content` | Request succeeded without a response body | Logout |
| `400 Bad Request` | Invalid request | Validation errors, invalid verification or reset token |
| `401 Unauthorized` | Authentication failed | Invalid credentials, missing or invalid access token |
| `403 Forbidden` | Request is not permitted | Unverified account attempting login, rejected Origin |
| `404 Not Found` | Endpoint does not exist | Unknown API route |
| `409 Conflict` | Request conflicts with existing data | Duplicate registered email |
| `429 Too Many Requests` | Rate limit exceeded | Excessive login or token requests |
| `500 Internal Server Error` | Unexpected server failure | Unhandled internal error |
| `503 Service Unavailable` | Required service temporarily unavailable | A required dependency is unavailable when the operation cannot safely proceed |

The exact status code and error code for each endpoint must follow the endpoint definitions below.

## 4. Authentication and Cookie Conventions

### 4.1 Access Token

The backend issues a JWT access token after successful login or refresh.

- Token lifetime: 15 minutes.
- Token type: Bearer.
- The frontend holds the access token in memory.
- Protected requests send it using the Authorization header.

Example:

`Authorization: Bearer <accessToken>`

The frontend must not store the access token in localStorage or sessionStorage.

### 4.2 Refresh Token Cookie

The backend issues an opaque refresh token in a cookie named:

`northstar_refresh`

Cookie configuration:

- `HttpOnly: true`
- `Secure: true` in production over HTTPS; disabled for local HTTP development.
- `SameSite=Lax` for the intended same-site deployment.
- `Path=/api/v1/auth`
- No explicit `Domain` attribute.
- No persistent `Max-Age`; the browser cookie is session-only.

The refresh token's server-side lifetime is limited to seven days.

The backend stores only a hash of the refresh token. On successful refresh, the old token is revoked and a replacement is issued.

The frontend shall include browser credentials on login, refresh, logout, and any other operation that needs to set, send, or clear the refresh cookie.

The Express CORS configuration must allow the configured frontend origin and credentials. The backend must validate the Origin for cookie-dependent state-changing operations.

### 4.3 Authenticated User

The frontend must not consider a user authenticated based solely on local navigation or a locally stored name.

Protected API responses determine whether the authentication state is valid.

## 5. Endpoint Inventory

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| `GET` | `/health` | Health check | Public |
| `POST` | `/auth/register` | Register a new user | Public |
| `POST` | `/auth/verify-email` | Verify email ownership | Public |
| `POST` | `/auth/resend-verification` | Request another verification email | Public |
| `POST` | `/auth/login` | Authenticate a verified user | Public |
| `POST` | `/auth/refresh` | Rotate the refresh token and issue a new access token | Refresh cookie |
| `POST` | `/auth/logout` | Revoke the refresh token and clear the cookie | Refresh cookie when available |
| `GET` | `/auth/me` | Retrieve the authenticated user | Access token |
| `POST` | `/auth/forgot-password` | Request password recovery | Public |
| `POST` | `/auth/reset-password` | Set a new password using a reset token | Public |

All paths above are relative to `/api/v1`.

## 6. Endpoint Specifications

### 6.1 Health Check

**Endpoint:** `GET /api/v1/health`

Purpose: Confirm that the API process is responding.

Request body: None.

Successful response: `200 OK`

```json
{
  "message": "API is healthy",
  "data": {
    "status": "ok"
  }
}
```

The health endpoint must not expose database credentials, environment variables, or other sensitive configuration.

### 6.2 Register a User

**Endpoint:** `POST /api/v1/auth/register`

Purpose: Create an unverified user account and initiate email verification.

Request body:

```json
{
  "name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "password": "A-Long-Example-Password",
  "acceptedTerms": true
}
```

Validation:

- `name` is required, trimmed, and must contain between 2 and 100 characters.
- `email` is required and must have a valid email format.
- `password` must contain at least 15 characters and at most 128 characters.
- `acceptedTerms` must be `true`.
- Password confirmation is a frontend validation field and is not sent as a separate credential.
- The backend is the authoritative source for all validation.
- Passwords must be hashed using Argon2id before storage.

The `acceptedTerms` field will not be persisted in the database in this release.

Successful response: `201 Created`

```json
{
  "message": "Account created. Email verification is required before login.",
  "data": {
    "user": {
      "id": "user_123",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "emailVerified": false
    },
    "nextStep": "VERIFY_EMAIL"
  }
}
```

The user ID shown is an example, not a real identifier.

The response must not claim that an email was delivered unless delivery was confirmed. In development, a documented local testing mechanism may provide the verification link without exposing the raw token through a production API response.

Error responses:

- `400 VALIDATION_ERROR` — Invalid input.
- `409 EMAIL_ALREADY_REGISTERED` — The email address is already registered.
- `429 RATE_LIMIT_EXCEEDED` — Registration rate limit exceeded.
- `500 INTERNAL_SERVER_ERROR` — Unexpected failure.

The backend must enforce unique email addresses in the database in addition to checking for existing accounts in application logic.

### 6.3 Verify Email

**Endpoint:** `POST /api/v1/auth/verify-email`

Purpose: Verify the ownership of the email address associated with an unverified account.

Request body:

```json
{
  "token": "<verificationToken>"
}
```

Successful response: `200 OK`

```json
{
  "message": "Email verified successfully. You can now sign in.",
  "data": {
    "emailVerified": true
  }
}
```

Validation and behavior:

- The token must be generated using a cryptographically secure random source.
- Only a hash of the token is stored.
- The token expires after 24 hours.
- The token may be used only once.
- The backend must verify that the token exists, has not expired, and has not been used.
- Updating the user's verification state and consuming the token must be handled atomically.

Error responses:

- `400 VERIFICATION_TOKEN_INVALID` — Missing, invalid, expired, or already-used token.
- `429 RATE_LIMIT_EXCEEDED` — Too many attempts.
- `500 INTERNAL_SERVER_ERROR` — Unexpected failure.

The frontend should provide a link or action to request a new verification message when verification fails.

### 6.4 Resend Verification Email

**Endpoint:** `POST /api/v1/auth/resend-verification`

Purpose: Request another email-verification message.

Request body:

```json
{
  "email": "ahmed@example.com"
}
```

Successful response: `202 Accepted`

```json
{
  "message": "If verification is available for this account, instructions will be sent."
}
```

Behavior:

- Normalize the email address.
- Apply rate limiting.
- If an eligible unverified account exists, generate a new verification token and invalidate the previous unused token.
- If the address is unknown or already verified, return the same public response.
- Do not reveal account existence in the public response.
- Do not claim successful delivery when the email provider has not delivered the message.

Error responses:

- `400 VALIDATION_ERROR` — Invalid email format.
- `429 RATE_LIMIT_EXCEEDED` — Too many requests.
- `500 INTERNAL_SERVER_ERROR` — Unexpected failure.

### 6.5 Login

**Endpoint:** `POST /api/v1/auth/login`

Purpose: Authenticate a verified user.

Request body:

```json
{
  "email": "ahmed@example.com",
  "password": "A-Long-Example-Password"
}
```

The frontend must include browser credentials so the refresh cookie can be set.

Successful response: `200 OK`

```json
{
  "message": "Login successful",
  "data": {
    "accessToken": "<jwtAccessToken>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "user_123",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "emailVerified": true
    }
  }
}
```

Cookie behavior:

The backend sets the `northstar_refresh` HttpOnly cookie. The refresh token itself must not appear in the JSON response.

Validation and behavior:

- Validate the email and password fields.
- Retrieve the user by normalized email.
- Verify the password against the stored Argon2id hash.
- Require `emailVerified = true`.
- Issue a JWT access token valid for 15 minutes.
- Create a hashed refresh-token record with a maximum seven-day server-side lifetime.
- Set the refresh cookie using the approved cookie configuration.

Successful login should cause the frontend to store the access token in memory and navigate to `/welcome`.

Error responses:

- `400 VALIDATION_ERROR` — Missing or malformed input.
- `401 INVALID_CREDENTIALS` — Incorrect email or password.
- `403 EMAIL_NOT_VERIFIED` — Correct credentials for an unverified account.
- `429 RATE_LIMIT_EXCEEDED` — Too many login attempts.
- `500 INTERNAL_SERVER_ERROR` — Unexpected failure.

Invalid email and incorrect password must produce the same public authentication error.

### 6.6 Refresh Access Token

**Endpoint:** `POST /api/v1/auth/refresh`

Purpose: Issue a new access token and rotate the refresh token.

Request body: None.

The browser must include credentials so the refresh cookie is sent.

Successful response: `200 OK`

```json
{
  "message": "Authentication refreshed successfully",
  "data": {
    "accessToken": "<newJwtAccessToken>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "user_123",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "emailVerified": true
    }
  }
}
```

Cookie behavior:

The backend replaces the old `northstar_refresh` cookie with a new value using the same approved cookie attributes.

Validation and behavior:

- Read the refresh token from the cookie.
- Hash it and find the matching database record.
- Reject expired, revoked, invalid, or otherwise ineligible tokens.
- Revoke the previous token and create its replacement.
- Issue a new access token.
- Handle token rotation atomically and guard against concurrent refresh requests.
- If a previously revoked refresh token is reused and its user can be identified safely, revoke that user's active refresh tokens.

Error responses:

- `401 REFRESH_TOKEN_INVALID` — Missing, expired, revoked, or invalid refresh token.
- `403 ORIGIN_NOT_ALLOWED` — Request Origin is not allowed.
- `429 RATE_LIMIT_EXCEEDED` — Too many attempts.
- `500 INTERNAL_SERVER_ERROR` — Unexpected failure.

The frontend should clear its in-memory authentication state and redirect to login if refresh fails and no valid authentication state can be restored.

### 6.7 Logout

**Endpoint:** `POST /api/v1/auth/logout`

Purpose: End the current authentication experience and revoke the refresh token when available.

Request body: None.

The browser must include credentials.

Successful response: `204 No Content`

Cookie behavior:

The backend clears the `northstar_refresh` cookie using the same cookie name, path, and other applicable attributes.

Behavior:

- Revoke the associated refresh-token record when a valid record is available.
- Clear the refresh cookie.
- Treat a missing or already-revoked refresh token as a successful logout.
- The frontend must clear the access token and user state held in memory.

Error responses:

- `403 ORIGIN_NOT_ALLOWED` — Request Origin is not allowed.
- `500 INTERNAL_SERVER_ERROR` — Unexpected failure that prevents the server operation from completing.

The frontend may clear local state immediately, but it must not claim confirmed server-side revocation if the request's outcome is unknown.

An already-issued access JWT may remain valid until its 15-minute expiration.

### 6.8 Get Current User

**Endpoint:** `GET /api/v1/auth/me`

Purpose: Return the profile of the user associated with a valid access token.

Required header:

`Authorization: Bearer <jwtAccessToken>`

Request body: None.

Successful response: `200 OK`

```json
{
  "message": "Current user retrieved successfully",
  "data": {
    "user": {
      "id": "user_123",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "emailVerified": true
    }
  }
}
```

Behavior:

- Validate the access token's signature, permitted algorithm, issuer, audience, and expiration.
- Obtain the user ID from the verified token.
- Retrieve the appropriate current user information.
- Return only permitted, non-sensitive profile fields.

Error responses:

- `401 AUTHENTICATION_REQUIRED` — No access token provided.
- `401 ACCESS_TOKEN_INVALID` — Invalid, malformed, or expired access token.
- `500 INTERNAL_SERVER_ERROR` — Unexpected failure.

The `/welcome` page must rely on a successful authenticated API result, not navigation alone.

### 6.9 Forgot Password

**Endpoint:** `POST /api/v1/auth/forgot-password`

Purpose: Request a password-reset link.

Request body:

```json
{
  "email": "ahmed@example.com"
}
```

Successful response: `202 Accepted`

```json
{
  "message": "If an account is associated with this address, password-reset instructions will be sent."
}
```

Behavior:

- Validate and normalize the email address.
- Apply rate limiting.
- If an eligible user account exists, generate a cryptographically random reset token.
- Store only the token hash.
- Set the token expiration to 30 minutes.
- Attempt delivery through the configured email-service interface.
- Return the same public message whether the address exists or not.

The public response must not reveal account existence.

If the real email provider has not been configured, use only an explicitly documented local development mechanism. Do not claim that a real email was sent.

Error responses:

- `400 VALIDATION_ERROR` — Invalid email format.
- `429 RATE_LIMIT_EXCEEDED` — Too many requests.
- `500 INTERNAL_SERVER_ERROR` — Unexpected failure before the request can be handled safely.

### 6.10 Reset Password

**Endpoint:** `POST /api/v1/auth/reset-password`

Purpose: Set a new password using a valid reset token.

Request body:

```json
{
  "token": "<passwordResetToken>",
  "newPassword": "A-Different-Long-Password"
}
```

The password-confirmation field is validated by the frontend but is not sent to the backend because it is not a separate credential.

Password rules:

- Minimum 15 characters.
- Maximum 128 characters.
- Do not require a fixed combination of uppercase letters, lowercase letters, digits, and symbols.
- Apply the backend password policy and appropriate weak-password checks.

Successful response: `200 OK`

```json
{
  "message": "Password reset successfully. Please sign in again."
}
```

Behavior:

- Validate the token and password.
- Find the token by its stored hash.
- Reject tokens that are missing, invalid, expired, or already used.
- Hash the new password using Argon2id.
- Update the user's password hash.
- Consume or invalidate the reset token.
- Revoke the user's active refresh-token records.
- Commit the password update and related database changes atomically.
- Clear the refresh cookie where appropriate.

Error responses:

- `400 VALIDATION_ERROR` — New password does not meet the requirements.
- `400 RESET_TOKEN_INVALID` — Missing, invalid, expired, or used reset token.
- `429 RATE_LIMIT_EXCEEDED` — Too many attempts.
- `500 INTERNAL_SERVER_ERROR` — Unexpected failure.

After success, the user must log in with the new password. Previously issued access tokens may remain valid until expiration.

## 7. Global Validation Rules

The backend shall validate all request bodies independently of frontend validation.

The initial input rules are:

| Field | Rule |
|---|---|
| `name` | Required; trim whitespace; 2–100 characters |
| `email` | Required; valid email format; normalize before lookup |
| `password` | Registration and password reset: 15–128 characters |
| `password` on login | Required; verify against stored hash without silently trimming |
| `acceptedTerms` | Must be `true` for registration |
| `token` | Required for verification and reset operations |
| `newPassword` | Must meet the agreed password policy |

The backend should reject malformed JSON and unexpected input types with a consistent error format.

Database uniqueness constraints remain necessary even when application validation checks for duplicates.

## 8. Rate-Limiting Requirements

Rate limits should be applied to sensitive operations, especially:

- Registration.
- Login.
- Refresh.
- Resend verification.
- Forgot password.
- Verify email.
- Reset password.

Exact thresholds may be established during implementation based on the learning environment and deployment requirements.

Rate limiting must not be implemented only in frontend code.

## 9. Email Token Handling

Email-verification and password-reset tokens must:

- Be generated from a cryptographically secure random source.
- Be sent only through the intended verification or recovery mechanism.
- Be stored only as hashes in the database.
- Have the documented expiration period.
- Be consumed only once.
- Never be returned in production API responses.
- Never be logged in production.

In local development, a clearly documented mechanism may expose verification links in a local-only workflow to support testing before a real email provider is configured.

## 10. Frontend Integration Requirements

The frontend authentication service shall use the API paths specified in this document.

For authenticated requests, the frontend sends the access token using the Bearer Authorization header.

For login, refresh, logout, and other operations that require cookie handling, the frontend must include credentials in accordance with the deployment configuration.

The access token remains in memory and is not persisted in browser storage.

When the application is reopened and no access token is present, the frontend may call `/auth/refresh` using the refresh cookie. If refresh fails, it clears the authenticated state and requires login.

The frontend must map the API error codes to accessible user-facing messages.

## 11. Definition of Done

The API Contract is ready for implementation when:

- Every required authentication flow has a defined endpoint.
- Every endpoint has an agreed method and path.
- Request bodies and response bodies are documented.
- Success and failure HTTP status codes are defined.
- Authentication headers and cookie behavior are explicit.
- Validation rules are consistent with the requirements and system design.
- Sensitive token handling and email-enumeration behavior are documented.
- The frontend and backend can be implemented independently against this contract.

The next document is `docs/05-database-design.md`, where the data models, fields, relationships, constraints, indexes, and Prisma migration strategy will be defined.
