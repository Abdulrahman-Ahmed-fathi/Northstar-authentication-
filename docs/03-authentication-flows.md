# Authentication Flows — Northstar Authentication System

**Document:** Authentication Flows Specification  
**Version:** 0.1  
**Status:** Initial Draft  
**Related Documents:**
- `docs/01-requirements.md`
- `docs/02-system-design.md`

---

## 1. Purpose

This document defines the step-by-step behavior of the Northstar authentication system.

It describes the expected interactions between the user, Next.js frontend, Express.js backend, Prisma data access layer, NeonDB database, and email service.

Each flow includes its normal execution path, alternative outcomes, security considerations, and expected final state.

Detailed HTTP request and response schemas will be documented separately in `docs/04-api-contract.md`.

## 2. Actors and Components

### Actors

- **Visitor:** A person who has not authenticated.
- **Unverified User:** A registered user who has not verified their email address.
- **Verified User:** A registered user whose email address has been verified.
- **Authenticated User:** A verified user with valid authentication credentials.

### Components

- **Frontend:** Next.js application.
- **Backend:** Express.js REST API.
- **Authentication Service:** Implements authentication business rules.
- **Prisma:** Handles database access.
- **NeonDB:** Stores user accounts and token records.
- **Email Service:** Provides an interface for sending verification and password-reset messages.

The backend is authoritative for authentication and authorization decisions. Frontend state or navigation alone must never be considered proof of authentication.

---

## 3. Global Rules

All authentication flows must follow these rules:

1. Validate user input on both the frontend and backend.
2. Treat backend validation as authoritative.
3. Never store plaintext passwords.
4. Store passwords using Argon2id password hashing.
5. Store only cryptographic hashes of email-verification, password-reset, and refresh tokens.
6. Verification and password-reset tokens must expire and be usable only once.
7. Access JWTs expire after 15 minutes.
8. Refresh tokens have a maximum server-side lifetime of 7 days.
9. Email-verification tokens expire after 24 hours.
10. Password-reset tokens expire after 30 minutes.
11. Unverified users must not obtain normal authenticated access.
12. Public password-recovery responses must not reveal whether an account exists.
13. Protected backend endpoints must validate authentication credentials independently of frontend behavior.
14. Public error responses must not expose secrets, database credentials, or internal stack traces.
15. The backend must handle expected failures without leaving partially updated authentication state.

---

## 4. Flow A — User Registration

### Objective

Allow a visitor to create an account and initiate email verification.

### Preconditions

- The visitor can access the registration page.
- The registration form collects a name, email, password, password confirmation, and terms acceptance.

### Main Flow

1. The visitor opens `/signup`.
2. The visitor enters the required information.
3. The frontend validates the submitted fields.
4. The visitor submits the registration form.
5. The frontend sends the registration request to the backend.
6. The backend validates all submitted fields.
7. The backend applies the email-normalization policy.
8. The backend checks whether an account already exists for the normalized email address.
9. The backend hashes the password using Argon2id.
10. The backend creates a user account with email verification still pending.
11. The backend generates a cryptographically random email-verification token.
12. The backend stores the token's hash and expiration timestamp.
13. The backend initiates email delivery through the email-service interface.
14. The frontend displays a message instructing the visitor to verify their email address.

### Alternative Flows

**A1. Invalid Input**

If the input is invalid, the backend rejects the request and the frontend displays suitable field-level errors.

**A2. Existing Email Address**

If the email address already exists, the backend rejects the duplicate registration. The frontend displays an appropriate message without revealing unnecessary account details.

**A3. Database Failure**

If the database operation fails, the registration is not reported as successful.

The backend returns a controlled error response.

**A4. Email Delivery Failure**

If account creation succeeds but email delivery fails, the backend must not claim that an email was delivered.

The account remains unverified. The user can retry verification delivery through the appropriate flow.

The system must prevent the same request from accidentally creating multiple user accounts.

### Postconditions

- A successful registration creates one unverified user account.
- The stored password is a hash, not plaintext.
- A verification token record exists.
- No authenticated session is created by registration alone.
- The user must complete email verification before normal login succeeds.

---

## 5. Flow B — Email Verification

### Objective

Verify ownership of the email address associated with a registered account.

### Preconditions

- A user account exists.
- The account has not yet been verified.
- A verification token has been generated and has not expired.

### Main Flow

1. The user opens the verification link received by email.
2. The link opens the frontend verification interface, such as `/verify-email`.
3. The frontend extracts the verification token from the link.
4. The frontend submits the token to the backend.
5. The backend hashes the submitted token and looks for a matching token record.
6. The backend checks that the token exists, has not expired, and has not been used.
7. The backend marks the user's email as verified.
8. The backend marks the verification token as used or invalidates it.
9. The backend commits the account and token changes atomically.
10. The frontend displays a successful verification message.
11. The user is directed to `/login`.

### Alternative Flows

**B1. Missing Token**

The frontend displays a message that the verification link is invalid.

**B2. Invalid, Expired, or Previously Used Token**

The backend rejects the token. The frontend explains that verification could not be completed and provides an appropriate recovery action.

**B3. Already Verified Account**

The frontend displays a suitable message and directs the user to login.

### Resend Verification

1. The user requests another verification message.
2. The backend applies rate limiting.
3. The backend processes the request without unnecessarily revealing whether an account exists.
4. If appropriate, the backend generates a replacement verification token.
5. The previous unused token is invalidated.
6. The email service attempts delivery.
7. The frontend displays neutral confirmation feedback.

The verification flow must not authenticate the user automatically in the initial release.

### Postconditions

- A valid verification token can activate the account only once.
- The account's verified state is persisted in the database.
- The user proceeds to the login flow to obtain authentication credentials.

---

## 6. Flow C — User Login

### Objective

Authenticate a verified user and establish the application's authenticated state.

### Preconditions

- The user has a registered account.
- The user's email address has been verified.

### Main Flow

1. The user opens `/login`.
2. The user submits an email address and password.
3. The frontend validates the basic form fields.
4. The frontend sends the login request to the backend.
5. The backend validates the submitted data.
6. The backend retrieves the account using the normalized email address.
7. The backend verifies the submitted password against the stored Argon2id hash.
8. The backend verifies that the account's email address has been verified.
9. The backend generates a short-lived JWT access token with a 15-minute expiration.
10. The backend generates a cryptographically random refresh token.
11. The backend stores only the refresh token's hash, along with its expiration and revocation metadata.
12. The backend sets the refresh token in an HttpOnly cookie.
13. The backend returns the access token and the permitted user information.
14. The frontend stores the access token in memory.
15. The frontend establishes the authenticated UI state.
16. The frontend navigates the user to `/welcome`.
17. The welcome page retrieves or verifies the current user's information through the backend.

### Alternative Flows

**C1. Invalid Credentials**

If the email address or password is incorrect, the backend rejects the login without revealing sensitive account information.

**C2. Unverified Account**

The backend denies normal authentication. The frontend explains that email verification is required and offers an appropriate verification recovery action.

**C3. Rate Limit Exceeded**

The backend rejects excessive login attempts and returns an appropriate response.

**C4. Database or Internal Failure**

The backend returns a controlled error and does not establish an authenticated state.

### Postconditions

- Successful login creates a valid access token and refresh-token record.
- The frontend has the access token in memory.
- The refresh cookie is configured according to the approved deployment settings.
- The welcome page is accessible only when the user is authenticated.

---

## 7. Flow D — Refresh Access Token

### Objective

Obtain a new access token without requiring the user to enter their password again.

### Preconditions

- The browser has a refresh-token cookie.
- A corresponding refresh-token record may still be valid on the backend.

### Main Flow

1. The frontend detects that the access token is missing or expired.
2. The frontend submits a refresh request with browser credentials included.
3. The browser sends the refresh cookie to the backend.
4. The backend reads and validates the refresh token.
5. The backend computes the token hash and searches for a matching database record.
6. The backend checks that the token has not expired or been revoked.
7. The backend verifies that the associated user is still eligible for authentication.
8. The backend invalidates the old refresh token.
9. The backend creates a replacement refresh token and stores its hash.
10. The backend issues a new 15-minute access token.
11. The backend sets the replacement refresh cookie and returns the new access token.
12. The frontend replaces the previous in-memory access token.

The token validation, invalidation, and replacement must be implemented with suitable transaction and concurrency handling.

### Alternative Flows

**D1. Missing or Invalid Refresh Token**

The backend rejects the refresh request and clears the refresh cookie where appropriate.

**D2. Expired Refresh Token**

The backend rejects the request. The frontend clears the authenticated state and directs the user to login.

**D3. Revoked Token Reuse**

If a previously revoked refresh token is reused, the backend revokes all active refresh-token records belonging to the associated user, where the token's identity can be established safely.

The user must authenticate again.

**D4. Concurrent Refresh Requests**

The frontend should avoid submitting multiple refresh operations at the same time. The backend must handle token rotation without accidentally creating multiple valid replacements.

### Postconditions

- Successful refresh returns a new access token.
- The previous refresh token cannot be reused.
- Invalid or expired refresh tokens do not grant access.

---

## 8. Flow E — Retrieve Current User

### Objective

Determine whether the current request belongs to an authenticated user and retrieve permitted profile information.

### Main Flow

1. The frontend sends a request to the current-user endpoint.
2. The frontend includes the access token in the Authorization Bearer header.
3. The backend extracts and verifies the JWT.
4. The backend checks its signature, allowed algorithm, issuer, audience, and expiration.
5. The backend obtains the user identifier from the validated token.
6. The backend retrieves the user's permitted information.
7. The backend returns the current user's information.
8. The frontend uses the response to display the authenticated interface.

### Alternative Flows

**E1. Missing or Invalid Token**

The backend denies access.

**E2. Expired Access Token**

The frontend may attempt one refresh operation. If refresh fails, the frontend clears authentication state and redirects to login.

**E3. User No Longer Eligible for Authentication**

The backend denies access if the user no longer satisfies the applicable account requirements.

### Postconditions

The frontend can treat the user as authenticated only after receiving a valid response from the backend.

A locally stored name or manually opened `/welcome` URL does not establish identity.

---

## 9. Flow F — Logout

### Objective

End the current authenticated experience and revoke the refresh token.

### Preconditions

The browser may or may not still have a valid refresh-token cookie.

### Main Flow

1. The user activates the logout action.
2. The frontend submits a logout request with credentials included.
3. The backend reads the refresh token, if present.
4. The backend revokes the corresponding refresh-token record where possible.
5. The backend clears the refresh cookie using matching cookie attributes.
6. The frontend clears its in-memory access token and user state.
7. The frontend navigates to `/login`.

### Alternative Flows

**F1. Missing or Already Revoked Refresh Token**

The backend still clears the cookie and completes local logout safely.

**F2. Network Failure**

The frontend clears its local authenticated state, while informing the user that server-side revocation could not be confirmed if the operation's result is unknown.

The frontend must not claim that server-side revocation definitely succeeded when it could not confirm the result.

### Postconditions

- The refresh token is revoked when successfully processed.
- The browser refresh cookie is cleared.
- The frontend no longer considers the user authenticated.

A previously issued access JWT may remain valid until its 15-minute expiration. Immediate access-token revocation is outside the initial scope.

---

## 10. Flow G — Forgot Password

### Objective

Allow a visitor to initiate password recovery without revealing whether an account exists.

### Main Flow

1. The visitor opens `/forgot-password`.
2. The visitor submits an email address.
3. The frontend validates the email format.
4. The backend validates the request and applies rate limiting.
5. The backend returns a neutral public response.
6. If an eligible account exists, the backend generates a cryptographically random reset token.
7. The backend stores only the token hash and its 30-minute expiration timestamp.
8. The email service attempts to deliver a reset link.
9. The frontend displays neutral confirmation feedback.

### Alternative Flows

**G1. Unknown Email Address**

The backend returns the same general public response, without revealing whether the account exists.

**G2. Rate Limit Exceeded**

The backend applies the agreed rate-limit behavior and does not create unnecessary reset tokens.

**G3. Email Delivery Failure**

The backend must not claim that an email was delivered.

The user may retry after the applicable restrictions permit it.

**G4. Email Provider Not Configured**

In development, a clearly identified test mechanism may be used. Production must not simulate successful delivery.

Raw reset tokens must not be logged in production.

### Postconditions

- A valid reset token is created only when appropriate.
- The token expires after 30 minutes.
- Public responses do not reveal account existence.

---

## 11. Flow H — Reset Password

### Objective

Allow a user to set a new password using a valid password-reset token.

### Preconditions

- The visitor has received a reset link.
- The link contains a valid, unexpired reset token.

### Main Flow

1. The visitor opens `/reset-password`.
2. The frontend extracts the reset token from the link.
3. The visitor submits a new password and password confirmation.
4. The frontend validates the form.
5. The backend validates the reset token and the new password.
6. The backend locates the token by its hash.
7. The backend verifies that the token is not expired or already used.
8. The backend hashes the new password using Argon2id.
9. The backend updates the user's stored password hash.
10. The backend invalidates the reset token.
11. The backend revokes the user's active refresh-token records.
12. The backend commits the password change and associated token changes atomically.
13. The backend clears the refresh cookie where applicable.
14. The frontend displays a success message.
15. The user is redirected to login to authenticate with the new password.

### Alternative Flows

**H1. Missing, Invalid, Expired, or Used Token**

The backend rejects the reset request. The frontend displays a clear error and provides a way to request another reset link.

**H2. Invalid Password**

The backend rejects the password that does not satisfy the agreed password policy.

**H3. Database Failure**

The password change must not be reported as successful if the required database transaction fails.

### Postconditions

- The new password is stored as a secure hash.
- The reset token cannot be reused.
- Active refresh-token records for the user are revoked.
- The user must log in again.

Previously issued access JWTs may remain valid until they expire. Immediate invalidation of all previously issued access tokens is not part of the initial scope.

---

## 12. Shared Failure-Handling Rules

The following rules apply to all authentication workflows:

- Use consistent error handling throughout the API.
- Distinguish validation failures from unexpected internal errors.
- Apply rate limits to sensitive authentication operations.
- Avoid exposing account existence through password-recovery responses.
- Avoid returning sensitive values in error responses.
- Never log passwords, raw refresh tokens, password-reset tokens, or email-verification tokens in production.
- Use database constraints to protect unique values and data integrity.
- Use transactions when multiple database changes must succeed or fail together.
- Make token verification and invalidation safe against concurrent requests.
- Provide clear recovery guidance when users encounter expired or invalid links.

The API Contract will specify the exact HTTP status codes and response formats.

---

## 13. Development and Email Delivery Constraints

A real email provider has not yet been selected.

During development, email-dependent workflows may use an explicitly identified local testing mechanism. The mechanism must not be mistaken for production email delivery.

The implementation must remain replaceable with a real email provider without changing the authentication business rules.

A flow cannot be considered production-complete until email delivery, verification-link handling, password-reset-link handling, and related failure cases have been tested.

---

## 14. Definition of Done

This document is considered ready for API design when:

- The success path for each authentication flow is defined.
- Common failure paths are documented.
- The access-token and refresh-token lifecycle is understood.
- Email-verification and password-reset requirements are explicit.
- The frontend and backend responsibilities are clear.
- No unresolved flow requires inventing behavior during implementation.

The next document is `docs/04-api-contract.md`, which will convert these workflows into concrete HTTP endpoints, request schemas, response schemas, and status codes.