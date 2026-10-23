# System Design — Northstar Authentication System

**Version:** 0.2  
**Status:** Initial Design — Decisions Finalized  
**Related Document:** `docs/01-requirements.md`

## 1. Purpose

This document defines the high-level architecture, component responsibilities, authentication strategy, security decisions, and technology choices for the Northstar Authentication System.

The system will be implemented with a Next.js frontend, a Node.js and Express.js backend, and NeonDB PostgreSQL accessed through Prisma.

## 2. High-Level Architecture

```text
User
 |
 v
Next.js Frontend
 |
 | HTTP API + Access Token
 v
Express.js REST API
 |
 +-- Authentication Module
 |     +-- Routes
 |     +-- Controllers
 |     +-- Services
 |     +-- Repository
 |
 +-- Validation Middleware
 +-- Authentication Middleware
 +-- Error Handler
 |
 v
Prisma ORM
 |
 v
NeonDB PostgreSQL

Express.js --> Email Service --> Email Provider
                                (selected later)
```

The frontend must never connect directly to NeonDB. All database access must go through the backend.

## 3. Component Responsibilities

### 3.1 Frontend

The frontend is responsible for rendering forms, performing client-side validation, sending HTTP requests, displaying feedback, and maintaining in-memory authentication state.

The frontend must not generate JWTs, hash passwords for storage, or contain backend secrets.

### 3.2 Express REST API

The backend is responsible for validating requests, applying authentication rules, executing business logic, issuing and validating JWTs, managing refresh tokens, and returning consistent HTTP responses.

### 3.3 Authentication Module

The initial authentication module owns registration, email verification, login, refresh, logout, current-user retrieval, forgot-password, and reset-password operations.

A separate user-management module may be introduced when the application requires more user-profile functionality.

### 3.4 Data Access

Prisma manages the application data model and database queries. NeonDB stores users, verification tokens, reset tokens, and refresh-token records.

### 3.5 Email Service

The backend will use an isolated email-service interface for verification and password-reset messages. A real provider will be selected later.

Until a provider is configured, any development-only email simulation must be clearly identified. Raw verification and reset tokens must never be logged in production.

## 4. Authentication Strategy

### 4.1 Access Token

The backend shall issue a short-lived JWT access token after successful authentication.

- Lifetime: 15 minutes.
- Signing algorithm: HS256, with explicit algorithm verification.
- Signing secret: a strong, randomly generated secret stored in a backend-only environment variable.
- Required claims: subject (`sub`), issuer (`iss`), audience (`aud`), issued-at (`iat`), and expiration (`exp`).
- The token shall contain no password, signing secret, or unnecessary sensitive user information.

The backend shall use a maintained JWT library rather than implementing token signing or verification manually.

### 4.2 Refresh Token

The refresh token shall be an opaque, cryptographically random value, not another JWT.

- Maximum server-side lifetime: 7 days.
- Store only a cryptographic hash of the token in the database.
- Send it using an HttpOnly cookie.
- Rotate the refresh token on every successful refresh.
- Revoke the previous token when issuing its replacement.
- Reject expired or revoked tokens.
- If a revoked refresh token is reused, revoke all active refresh tokens belonging to the associated user.
- Revoke the user's active refresh tokens after a successful password reset.

The browser cookie shall be session-only because Remember me is outside the initial scope. The seven-day limit remains the maximum validity on the server.

### 4.3 Access-Token Storage

The frontend shall hold the access token in memory and send it to protected endpoints using the `Authorization: Bearer` header.

The access token shall not be persistently stored in localStorage or sessionStorage.

When the application starts or the in-memory token is missing, the frontend may call the refresh endpoint to establish a new authenticated state using the refresh cookie.

### 4.4 Logout and Revocation

Logout shall revoke the relevant refresh-token record, clear the refresh cookie, and remove the access token and user state from frontend memory.

An issued access JWT may remain valid until its 15-minute expiration. Immediate individual access-token revocation is not part of the initial release.

## 5. Cookie, CORS, and CSRF Configuration

The refresh cookie shall use the following configuration:

- `HttpOnly: true`
- `Secure: true` in production over HTTPS; disabled for local HTTP development
- `SameSite: Lax` for the selected same-site deployment arrangement
- `Path: /api/v1/auth`
- No explicit `Domain` attribute
- No `Max-Age`, to keep the cookie session-only

Cookie-dependent frontend requests shall include credentials.

The Express CORS configuration shall allow only the configured frontend origin and enable credentials. Wildcard origins shall not be used with credentialed requests.

The backend shall validate the request Origin for cookie-dependent state-changing operations, including refresh and logout. If deployment later requires cross-site cookies, the design must be updated to include `SameSite=None; Secure` and an appropriate explicit CSRF defense.

## 6. Authentication Workflows

### 6.1 Registration

1. Validate the submitted name, email, password, and terms-acceptance input.
2. Normalize the email according to the application's defined comparison policy.
3. Check for an existing account.
4. Hash the password using Argon2id.
5. Create an unverified user account.
6. Generate a cryptographically random verification token and store only its hash.
7. Initiate email delivery through the email-service abstraction.
8. Tell the user to check their email.

Registration must not issue authenticated access before email verification.

### 6.2 Email Verification

1. The user opens the verification link.
2. The frontend extracts the token and submits it to the backend.
3. The backend validates the token hash, expiration, and unused status.
4. The backend marks the account as verified.
5. The token is invalidated.
6. The frontend displays the verification result and directs the user to login.

Email-verification tokens expire after 24 hours and are single-use.

### 6.3 Login

1. The backend validates the submitted credentials.
2. The backend retrieves the user and compares the submitted password with the stored Argon2id hash.
3. The backend rejects invalid credentials and unverified accounts.
4. The backend issues a 15-minute JWT access token.
5. The backend sets a refresh-token cookie.
6. The frontend retains the access token in memory and redirects to `/welcome`.

The welcome page must confirm authentication through the backend and must not rely on navigation alone.

### 6.4 Refresh

1. The frontend submits a refresh request with credentials included.
2. The backend validates the refresh cookie against the stored token hash.
3. The backend revokes the old token and creates its replacement.
4. The backend sets the replacement cookie and returns a new access token.

Invalid, expired, revoked, or reused tokens shall be rejected according to the defined revocation policy.

### 6.5 Forgot and Reset Password

Forgot-password requests shall use a generic public response that does not reveal whether an email address exists.

Password-reset tokens expire after 30 minutes and are single-use. Only the token hash shall be stored.

After validating the token, the backend shall hash the new password, update the user record, invalidate the reset token, and revoke the user's active refresh tokens.

## 7. Password Policy

- Minimum length: 15 characters.
- Maximum length: 128 characters.
- No mandatory combination of uppercase letters, lowercase letters, numbers, and symbols.
- Reject common or weak passwords using an appropriate blocklist.
- Use Argon2id for password hashing.
- Enforce the same agreed policy in the frontend and backend.

The backend is the authoritative source for validation.

## 8. API Endpoint Inventory

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Register a user |
| POST | `/api/v1/auth/verify-email` | Verify an email token |
| POST | `/api/v1/auth/resend-verification` | Request another verification message |
| POST | `/api/v1/auth/login` | Authenticate a verified user |
| POST | `/api/v1/auth/refresh` | Rotate refresh credentials |
| POST | `/api/v1/auth/logout` | Revoke refresh credentials |
| GET | `/api/v1/auth/me` | Retrieve the current user |
| POST | `/api/v1/auth/forgot-password` | Request password recovery |
| POST | `/api/v1/auth/reset-password` | Reset a password |
| GET | `/api/v1/health` | Check API health |

The complete request and response definitions will be documented separately in the API Contract.

## 9. Database Design Direction

The initial Prisma data model will contain the following entities:

### User

Stores the user ID, name, normalized unique email address, password hash, email-verification timestamp, creation timestamp, and update timestamp.

### EmailVerificationToken

Stores a user reference, unique token hash, expiration timestamp, usage timestamp, and creation timestamp.

### PasswordResetToken

Stores a user reference, unique token hash, expiration timestamp, usage timestamp, and creation timestamp.

### RefreshToken

Stores a user reference, unique token hash, expiration timestamp, revocation timestamp, and creation timestamp.

Important constraints include a unique normalized email address, unique token hashes, and appropriate foreign-key relationships and indexes.

The detailed Prisma models and migrations will be defined in the database-design stage.

## 10. Migrations and Database Connections

Prisma Migrate shall manage schema changes.

- Use `prisma migrate dev` for local development migrations.
- Commit migration files to version control.
- Use `prisma migrate deploy` to apply approved migrations in deployment.
- Use a pooled Neon connection for application queries and the appropriate direct connection for migration operations according to the selected Prisma configuration and version.

Database credentials must be stored in backend environment variables and must never be exposed to the frontend.

## 11. Backend Language and Structure

The initial backend shall use JavaScript with ES Modules and async/await to keep the implementation focused on backend fundamentals.

The proposed structure is:

```text
backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   └── env.js
│   ├── lib/
│   │   └── prisma.js
│   ├── middlewares/
│   │   ├── validate.js
│   │   ├── require-auth.js
│   │   ├── not-found.js
│   │   └── error-handler.js
│   ├── modules/
│   │   └── auth/
│   │       ├── auth.routes.js
│   │       ├── auth.controller.js
│   │       ├── auth.service.js
│   │       ├── auth.repository.js
│   │       └── auth.schemas.js
│   ├── services/
│   │   └── email.service.js
│   └── utils/
│       └── app-error.js
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Each layer shall have one primary responsibility. Routes map HTTP requests, controllers handle HTTP concerns, services implement business rules, repositories access data through Prisma, and middleware handles cross-cutting concerns.

TypeScript can be introduced after the first complete implementation if desired.

## 12. Deferred Items

The following items do not block the initial system design but must be completed before production deployment:

- Selection and configuration of the email provider.
- Final email templates and trusted verification/reset URLs.
- Detailed token and cookie implementation tests.
- Complete request and response schemas.
- Database model definitions and migrations.
- Automated tests for authentication and failure scenarios.
- Production deployment configuration and secret management.

Terms acceptance is required in the initial registration interface but will not be persisted in the database in this release. Production requirements may later require recording the accepted policy version and timestamp.

## 13. Next Stage

The next document is `docs/03-authentication-flows.md`.

It will define the step-by-step happy paths, failure paths, and expected transitions for registration, email verification, login, refresh, logout, forgot-password, and reset-password before the API Contract is finalized.




1. استراتيجية المصادقة
تم الاختيار
هنستخدم JWT قصير الصلاحية للوصول إلى الـ API، وRefresh Token عشوائي منفصل لتجديده.

الـ Access Token هيكون JWT، لكن الـ Refresh Token مش محتاج يكون JWT؛ تخزينه والتحكم في إبطاله هيكون أبسط بالطريقة دي.

السبب: تجربة استخدام جيدة مع إمكانية إنهاء الجلسات من السيرفر، بدل الاعتماد على JWT طويل الصلاحية فقط.




2. مدد صلاحية الـ Tokens

Access Token: 15 دقيقة.

Refresh Token: 7 أيام كحد أقصى على السيرفر.

Email Verification Token: 24 ساعة.

Password Reset Token: 30 دقيقة.

كل رمز تحقق أو استعادة سيكون عشوائيًا، محدود الصلاحية، ويُستخدم مرة واحدة. دي مدد عملية كبداية، وليست أرقامًا إلزامية من معيار موحد. إرشادات OWASP توصي بأن تكون رموز التحقق والاستعادة آمنة ومحدودة الصلاحية وأحادية الاستخدام. OWASP




3. Cookies وCORS

الـ Access Token سيبقى في ذاكرة الـ Frontend فقط، وليس في localStorage. أما الـ Refresh Token فسيُرسل داخل HttpOnly Cookie لا يستطيع JavaScript قراءتها مباشرة.

سنسمح للـ Frontend المحدد فقط بالاتصال بالـ API، مع دعم credentials، والتحقق من Origin للطلبات التي تعتمد على الكوكيز.




4. تخزين البيانات والرموز

هنستخدم Prisma مع NeonDB، وسنحفظ Hash لكلمات المرور، وHash لرموز التحقق والاستعادة والتجديد في قاعدة البيانات، وليس القيم السرية الأصلية.




5. API Design

هنثبت مجموعة Endpoints واضحة للتسجيل والتحقق والدخول والتجديد والخروج واستعادة كلمة المرور، ثم نوثّق كل Request وResponse قبل كتابة الـ Controllers.




6. Database وMigrations

هنبدأ بأربعة Models أساسية، ونستخدم Prisma Migrate لإدارة تغييرات الـ Schema بشكل منظم وقابل للتتبع.




7. لغة وتنظيم الـ Backend

هنستخدم JavaScript مع ES Modules وasync/await، وننظم الكود حسب الـ Features والـ Layers، مع Zod للـ Validation وPrisma للوصول إلى قاعدة البيانات.