# Requirements Specification — Northstar Authentication System

**Project:** Northstar Authentication  
**Document:** Software Requirements Specification  
**Version:** 0.2  
**Status:** Draft — Requirements Defined, Technical Design Pending  
**Frontend:** Next.js  
**Backend:** Node.js + Express.js  
**Database:** NeonDB (PostgreSQL)  
**ORM:** Prisma  
**Authentication:** JWT-based

---

## 1. Project Overview

Northstar Authentication is a web application authentication system that allows visitors to create accounts, verify their email addresses, sign in, and recover their passwords.

The frontend will use Next.js. The backend will be implemented separately using Node.js and Express.js. NeonDB will provide the PostgreSQL database, accessed through Prisma.

The frontend and backend will communicate through HTTP APIs. The frontend must not connect directly to the database.

This project focuses on the initial authentication release. Features unrelated to authentication are outside the current scope.

## 2. Project Objectives

The system shall:

1. Provide a professional and responsive authentication experience.
2. Allow visitors to register using their name, email address, and password.
3. Require email verification before granting authenticated access to a newly registered account.
4. Allow verified users to sign in using their credentials.
5. Use JWT-based authentication.
6. Provide a password-reset request and password-reset completion flow.
7. Store user information securely in PostgreSQL.
8. Provide consistent validation, error handling, and API responses.
9. Separate frontend presentation, backend business logic, and database access.
10. Support testing and future extension without major architectural changes.

## 3. Stakeholders and Actors

### 3.1 Visitor

A person who has not authenticated and may create an account, verify an email address, or request password recovery.

### 3.2 Registered User

A person who has an account and may sign in after satisfying the email-verification requirement.

### 3.3 Project Developer

The developer responsible for backend implementation, database design, authentication, testing, and frontend integration.

---

## 4. Scope

### 4.1 In Scope

- Login and registration interfaces.
- Email-verification flow.
- Forgot-password and reset-password flows.
- Welcome page after successful login.
- Frontend and backend input validation.
- JWT-based authentication.
- Secure password hashing.
- User persistence through Prisma and NeonDB.
- Appropriate authentication and verification errors.
- Configurable frontend-to-backend API communication.
- Responsive design and accessibility.
- Automated testing of essential authentication flows.
- A development email-delivery abstraction that can be connected to a real provider later.

### 4.2 Out of Scope

- Google, GitHub, or other social authentication.
- Multi-factor authentication in the initial release.
- Remember me functionality.
- Administrative dashboards and role management.
- Payments and subscriptions.
- Unrelated product features.
- Direct database access from the frontend.
- Persistent recording of terms-of-service acceptance.
- Production email-provider integration until the provider is selected.
- Additional authenticated product features beyond the initial welcome experience.

### 4.3 Dependencies

The complete email-verification and password-recovery flows depend on a functioning email-delivery mechanism.

The provider will be selected in a later implementation step. Development must not claim that a real email was delivered when no delivery provider is configured.

---

## 5. Functional Requirements

### FR-01: Application Routes

The frontend shall provide:

- `/login` — sign-in form.
- `/signup` — registration form.
- `/forgot-password` — password-recovery request.
- `/reset-password` — form for setting a new password.
- `/verify-email` — email-verification status and token-processing interface.
- `/welcome` — welcome page for a successfully authenticated, verified user.
- `/` — redirects to `/login`.

The welcome page shall not imply that the user is authenticated merely because the page was opened directly.

### FR-02: User Registration

The registration form shall accept:

- Full name.
- Email address.
- Password.
- Password confirmation.
- Acceptance of the terms of service and privacy policy.

The frontend shall validate the form before sending the request.

The backend shall independently validate the request, enforce unique email addresses, hash the password, and create the account in an unverified state.

Password confirmation shall be validated but shall not be stored as a separate credential.

Terms acceptance shall be required in the registration interface. Persisting an acceptance record in the database is outside the initial scope.

Successful registration shall display a clear confirmation that instructs the user to verify their email address. Registration alone shall not establish an authenticated state.

### FR-03: Email Verification

The system shall require users to verify their email addresses before they can obtain normal authenticated access.

The verification process shall use a secure, time-limited, single-use token.

The verification token shall be invalidated after successful use or expiration.

The backend shall not activate an account before successful verification.

The verification process shall provide understandable success, invalid-token, and expired-token states.

The implementation shall support a configurable email-delivery interface. A real email provider will be integrated later.

### FR-04: User Login

The system shall allow verified users to sign in using their email addresses and passwords.

The backend shall verify the credentials before issuing the authentication credentials.

Unverified accounts shall not receive normal authenticated access.

The backend shall avoid exposing sensitive internal information through authentication errors.

Successful login shall take the user to `/welcome`, where the frontend may display the authenticated user's name when it has been obtained from a trusted API response.

The frontend shall not treat a locally stored user name or a successful page navigation as proof of authentication.

### FR-05: JWT Authentication

The system shall use JWT-based authentication.

The backend shall issue authentication tokens only after successful credential verification and satisfaction of the email-verification requirement.

Protected endpoints shall validate authentication credentials before returning protected data.

Token expiry, refresh, storage, transport, and revocation policies shall be defined in the technical design before implementation.

The frontend shall not create or fabricate JWTs.

### FR-06: Forgot-Password Request

The system shall allow a visitor to submit an email address to initiate password recovery.

The backend shall validate the request and, when appropriate, generate a secure password-reset token.

The public response shall not reveal whether the submitted email address exists in the system.

The interface shall provide neutral confirmation feedback without falsely claiming successful email delivery when delivery has not occurred.

### FR-07: Reset Password

The reset-password screen shall allow a visitor with a valid reset token to choose a new password.

The backend shall validate the reset token and its expiration before changing the password.

Reset tokens shall be single-use and shall expire after a defined period.

After a successful reset, the token shall be invalidated.

The backend shall invalidate or appropriately manage existing authentication credentials according to the token-revocation strategy defined in the technical design.

### FR-08: Password Policy

The initial password policy shall be:

- Minimum length: 15 characters.
- The maximum accepted length must be at least 64 characters.
- Do not require a mandatory combination of uppercase letters, lowercase letters, digits, and symbols.
- Check against commonly used or known-compromised passwords on the backend where a suitable blocklist is available.
- Do not require routine password changes unless compromise is suspected or confirmed.
- Validate password confirmation on registration and reset-password forms.

The same password policy shall be enforced on the frontend and backend, with the backend as the authoritative source.

### FR-09: Authentication Feedback

The frontend shall provide appropriate loading, success, validation, and error states.

The backend shall use appropriate HTTP status codes and a consistent error-response structure.

Unexpected internal errors shall not expose stack traces, secret values, or database credentials to the client.

### FR-10: Frontend and Backend Integration

The frontend shall use a dedicated authentication service layer to communicate with the Express API.

The API base URL shall be configurable through environment variables.

The frontend shall not contain database credentials, password-hashing logic, JWT signing secrets, or other backend-only secrets.

Demo functionality shall remain separate from real authentication behavior.

### FR-11: Logout

The system shall provide a logout operation that ends or invalidates the user's authentication state according to the JWT strategy defined in the technical design.

The exact behavior of token invalidation and refresh-token revocation shall be documented before implementation.

---

## 6. Non-Functional Requirements

### NFR-01: Security

- Passwords must never be stored in plaintext.
- Passwords must be stored using an appropriate secure password-hashing algorithm.
- Database credentials and signing secrets must remain on the backend.
- Tokens must have defined expiration and handling policies.
- Email-verification and password-reset tokens must be time-limited and single-use.
- Protected endpoints must enforce authentication independently of frontend behavior.
- Authentication endpoints must have appropriate protections against abuse.
- Important data constraints must be enforced by the database where applicable.

### NFR-02: Usability

The interface shall provide clear messages and intuitive navigation between all authentication flows.

Users shall be informed when email verification is required and when an operation needs to be retried.

### NFR-03: Accessibility

Forms shall use semantic HTML, accessible labels, keyboard navigation, and visible focus states.

Validation errors shall be associated with the relevant form fields.

### NFR-04: Responsiveness

All included pages shall function correctly on desktop, tablet, and mobile devices without horizontal overflow.

### NFR-05: Maintainability

The frontend and backend shall separate presentation, HTTP request handling, business logic, validation, and database access.

Authentication behavior shall not be duplicated unnecessarily.

### NFR-06: Reliability

The system shall handle invalid data, duplicate registrations, incorrect credentials, expired tokens, failed email delivery, and database errors gracefully.

---

## 7. Assumptions and Constraints

- Northstar is a temporary project name.
- The frontend uses Next.js.
- The backend uses Node.js and Express.js.
- NeonDB provides PostgreSQL.
- Prisma is the selected ORM.
- The frontend and backend are separate applications.
- Email verification is required before authenticated access is granted.
- The JWT implementation details will be determined during technical design.
- Email-provider selection and production configuration are deferred.
- Remember me is excluded from the initial release.
- Terms acceptance is required by the frontend but will not be persisted in the database in this release.
- The initial welcome page is not a substitute for a complete dashboard.

---

## 8. Acceptance Criteria

### AC-01: Routing

All required authentication routes render correctly. The root route redirects to login, and the welcome page does not imply successful authentication without a valid authenticated state.

### AC-02: Registration

A valid registration request creates an unverified user record. Invalid data is rejected, duplicate emails are handled correctly, and passwords are never stored in plaintext.

### AC-03: Password Validation

The agreed password policy is enforced on the backend. Frontend validation provides consistent and understandable feedback.

### AC-04: Email Verification

A valid verification token activates the account. Invalid, expired, or previously used tokens do not activate the account.

### AC-05: Login

Valid credentials for a verified account establish an authenticated state. Incorrect credentials and unverified accounts do not receive normal authenticated access.

### AC-06: Protected Endpoints

Requests without valid authentication credentials cannot access protected resources. Expired or invalid tokens are rejected.

### AC-07: Password Recovery

Reset requests do not disclose whether an email address is registered. A valid reset token permits a password change; invalid, expired, and previously used tokens do not.

### AC-08: Password Reset Security

Passwords are hashed before storage, and reset-token handling follows the approved expiration and single-use policy.

### AC-09: Frontend Integration

The frontend communicates with the Express API through the designated service layer and configurable API base URL.

### AC-10: Email Delivery

Production acceptance of email verification and recovery requires a configured email provider. Before that dependency is available, only the explicitly documented development or test mechanism may be used.

### AC-11: Code Quality

The application has a maintainable structure, appropriate error handling, and passing applicable type checks, lint checks, and authentication tests.

---

## 9. Confirmed Decisions

| Decision | Resolution |
|---|---|
| Authentication method | JWT |
| Post-login destination | `/welcome` |
| Post-registration behavior | Instruct the user to verify their email |
| Password reset | Include `/reset-password` |
| Email verification | Required |
| Email provider | Select and integrate later |
| Password minimum length | 15 characters |
| Password composition rules | No mandatory character-class combination |
| Remember me | Excluded from initial scope |
| Terms acceptance persistence | Excluded from initial scope |
| Database access | Prisma |
| Database provider | NeonDB / PostgreSQL |

## 10. Remaining Technical Design Decisions

The following items belong to the next design stage rather than the requirements stage:

1. JWT access-token lifetime and transport.
2. Whether refresh tokens are needed, how they are stored, and how rotation and revocation work.
3. Verification-token and password-reset-token expiration periods.
4. The exact API endpoints, request and response schemas, and HTTP status codes.
5. The email-provider integration and verification-link configuration.
6. The Prisma data model, constraints, and migration strategy.
7. The error-response format and authentication rate limits.

## 11. Definition of Done

The authentication system shall be considered complete when the approved requirements are implemented, success and failure flows are tested, the frontend communicates with the real Express API, and email delivery is configured for the required production workflows.

No feature shall be described as complete if its required dependencies remain unconfigured or its behavior is only simulated.
