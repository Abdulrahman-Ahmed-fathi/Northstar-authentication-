# Database Design — Northstar Authentication System

**Document:** Database Design Specification  
**Version:** 0.1  
**Status:** Initial Draft  
**Database:** NeonDB — PostgreSQL  
**ORM:** Prisma  
**Related Documents:**
- `docs/01-requirements.md`
- `docs/02-system-design.md`
- `docs/03-authentication-flows.md`
- `docs/04-api-contract.md`

---

## 1. Purpose

This document defines the initial database model for the Northstar Authentication System.

It identifies the entities that must be persisted, their fields, relationships, constraints, indexes, and lifecycle requirements.

The data model is derived from the authentication requirements, system design, and API contract.

The initial release will contain four models:

1. User
2. EmailVerificationToken
3. PasswordResetToken
4. RefreshToken

## 2. Database Design Principles

The database design shall follow these principles:

- Store only information required for the agreed application scope.
- Avoid duplicating user information across related records.
- Represent relationships using foreign keys.
- Enforce unique values and important data-integrity rules in PostgreSQL.
- Store password hashes rather than plaintext passwords.
- Store hashes of verification, password-reset, and refresh tokens rather than their raw values.
- Track expiration and invalidation explicitly.
- Keep database access behind the Express backend and Prisma.
- Use Prisma Migrate to track and apply schema changes.

## 3. Entity Identification

### 3.1 User

The User model represents a registered account.

It stores identity information, the password hash, email-verification state, and account timestamps.

### 3.2 EmailVerificationToken

This model represents a token used to verify ownership of a user's email address.

Multiple records may exist for one user because verification can be requested again. Tokens may expire, be used successfully, or be invalidated when a replacement is issued.

### 3.3 PasswordResetToken

This model represents a token that authorizes a password-reset operation.

It has its own expiration and usage lifecycle. Keeping it separate from email-verification tokens makes the different purposes and rules easier to understand and maintain.

### 3.4 RefreshToken

This model represents the server-side record of a refresh token.

The raw token is held by the browser in an HttpOnly cookie. The database stores only its cryptographic hash, allowing the backend to validate, rotate, and revoke refresh tokens.

Access JWTs will not have a separate database model in the initial design because they are short-lived and are validated using their signature and registered claims.

---

## 4. Model: User

### Purpose

Stores a user's account information.

### Fields

| Field | Type | Required | Constraints / Purpose |
|---|---|---|---|
| `id` | UUID | Yes | Primary key |
| `name` | String | Yes | User's display name |
| `email` | String | Yes | Unique normalized email address |
| `passwordHash` | String | Yes | Argon2id password hash |
| `emailVerifiedAt` | DateTime | No | Verification timestamp; null means unverified |
| `createdAt` | DateTime | Yes | Account creation time |
| `updatedAt` | DateTime | Yes | Last account update time |

### Design Decisions

- Email addresses are trimmed and normalized to lowercase before being stored.
- `email` has a unique constraint.
- `passwordHash` contains the encoded output of the selected password-hashing algorithm, never the original password.
- `emailVerifiedAt` is nullable. The API derives `emailVerified: true` when this field is populated and `false` when it is null.
- `createdAt` and `updatedAt` use timezone-aware timestamps.
- User IDs use UUID values.

The current scope does not persist terms-of-service acceptance.

### Relationships

One User can have multiple:

- EmailVerificationToken records.
- PasswordResetToken records.
- RefreshToken records.

---

## 5. Model: EmailVerificationToken

### Purpose

Stores the state of email-verification tokens associated with users.

### Fields

| Field | Type | Required | Constraints / Purpose |
|---|---|---|---|
| `id` | UUID | Yes | Primary key |
| `userId` | UUID | Yes | Foreign key to User |
| `tokenHash` | String | Yes | Unique SHA-256 hash of the raw token |
| `expiresAt` | DateTime | Yes | Token expiration time |
| `usedAt` | DateTime | No | Time the token was successfully consumed |
| `revokedAt` | DateTime | No | Time the token was invalidated without successful use |
| `createdAt` | DateTime | Yes | Token record creation time |

### Constraints and Rules

- `tokenHash` must be unique.
- `userId` must reference an existing User.
- `expiresAt` must be checked during token validation.
- A token is valid only if it is unexpired, `usedAt` is null, and `revokedAt` is null.
- Successfully verifying an email sets `usedAt`.
- Replacing or invalidating an unused token sets `revokedAt`.
- The verification operation must update the user's verification state and consume the token atomically.

### Expiration

The configured token lifetime is 24 hours.

Expired or consumed token records may be removed later by a cleanup operation.

---

## 6. Model: PasswordResetToken

### Purpose

Stores password-reset tokens associated with users.

### Fields

| Field | Type | Required | Constraints / Purpose |
|---|---|---|---|
| `id` | UUID | Yes | Primary key |
| `userId` | UUID | Yes | Foreign key to User |
| `tokenHash` | String | Yes | Unique SHA-256 hash of the raw token |
| `expiresAt` | DateTime | Yes | Token expiration time |
| `usedAt` | DateTime | No | Time the token was successfully consumed |
| `revokedAt` | DateTime | No | Time the token was invalidated |
| `createdAt` | DateTime | Yes | Token record creation time |

### Constraints and Rules

- `tokenHash` must be unique.
- `userId` must reference an existing User.
- The backend validates expiration and usage state before accepting a reset request.
- A token cannot be used after expiration, successful consumption, or revocation.
- The password update and token-consumption operation must succeed or fail atomically.
- Successful password reset revokes active refresh-token records belonging to the user.

### Expiration

The configured token lifetime is 30 minutes.

The API must not reveal whether an email address exists when a password-reset request is submitted.

---

## 7. Model: RefreshToken

### Purpose

Stores refresh-token records required for token rotation and revocation.

### Fields

| Field | Type | Required | Constraints / Purpose |
|---|---|---|---|
| `id` | UUID | Yes | Primary key |
| `userId` | UUID | Yes | Foreign key to User |
| `tokenHash` | String | Yes | Unique SHA-256 hash of the opaque token |
| `expiresAt` | DateTime | Yes | Maximum server-side validity time |
| `revokedAt` | DateTime | No | Time the token was revoked |
| `createdAt` | DateTime | Yes | Token record creation time |

### Constraints and Rules

- `tokenHash` must be unique.
- `userId` must reference an existing User.
- A refresh token is valid only if it is unexpired and `revokedAt` is null.
- Each successful refresh revokes the old token and creates its replacement.
- Logout revokes the associated token.
- Password reset revokes the user's active refresh-token records.
- Reuse of a previously revoked refresh token triggers revocation of the user's remaining active refresh tokens when the account association can be established safely.
- Revoked records must remain available long enough to support the reuse-detection policy.

### Expiration

The maximum server-side lifetime is seven days.

The browser cookie will be a session-only cookie because Remember me is outside the current scope.

---

## 8. Relationships

The database contains the following one-to-many relationships:

| Parent | Child | Relationship |
|---|---|---|
| User | EmailVerificationToken | One user has many verification-token records |
| User | PasswordResetToken | One user has many password-reset-token records |
| User | RefreshToken | One user has many refresh-token records |

Every child model has a `userId` foreign key that references `User.id`.

If a User record is deleted, its associated token records shall be deleted through `onDelete: Cascade`.

This behavior prevents orphaned token records from remaining after account deletion.

---

## 9. Indexes and Database Constraints

The following constraints and indexes are required:

### User

- Primary key on `id`.
- Unique constraint on normalized `email`.

### EmailVerificationToken

- Primary key on `id`.
- Unique constraint on `tokenHash`.
- Index on `expiresAt` for expiration and cleanup queries.
- Index on `userId` for retrieving a user's verification records.
- Foreign key on `userId`.

### PasswordResetToken

- Primary key on `id`.
- Unique constraint on `tokenHash`.
- Index on `expiresAt` for expiration and cleanup queries.
- Index on `userId` for retrieving a user's reset-token records.
- Foreign key on `userId`.

### RefreshToken

- Primary key on `id`.
- Unique constraint on `tokenHash`.
- Index on `expiresAt` for cleanup operations.
- Composite index on `userId` and `revokedAt` to support finding and revoking active token records.
- Foreign key on `userId`.

Prisma's unique attributes and index declarations shall be used to express these constraints in the schema.

---

## 10. Token Hashing and Storage

The system uses different approaches for password hashing and token hashing.

### Passwords

Passwords are selected by users and may have limited entropy.

They must be hashed using Argon2id with an appropriate configuration. Plaintext passwords must never be stored.

### Verification, Reset, and Refresh Tokens

These tokens are generated using a cryptographically secure random source and contain sufficient randomness.

The application shall compute a SHA-256 hash of each raw token and store the hash in the appropriate table.

The raw verification, reset, and refresh tokens must never be stored in the database or logged in production.

When a raw token is presented, the backend hashes the submitted value and looks up the corresponding token record.

The `tokenHash` fields are unique within their respective tables.

---

## 11. Proposed Prisma Model Draft

The following model definitions represent the proposed database structure. They are a model draft, not a complete `schema.prisma` file.

```prisma
model User {
  id           String    @id @default(uuid()) @db.Uuid
  name         String
  email        String    @unique
  passwordHash String
  emailVerifiedAt DateTime? @db.Timestamptz(3)
  createdAt    DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime  @updatedAt @db.Timestamptz(3)

  emailVerificationTokens EmailVerificationToken[]
  passwordResetTokens    PasswordResetToken[]
  refreshTokens          RefreshToken[]
}

model EmailVerificationToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @db.Uuid
  tokenHash  String    @unique
  expiresAt  DateTime  @db.Timestamptz(3)
  usedAt     DateTime? @db.Timestamptz(3)
  revokedAt  DateTime? @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model PasswordResetToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @db.Uuid
  tokenHash  String    @unique
  expiresAt  DateTime  @db.Timestamptz(3)
  usedAt     DateTime? @db.Timestamptz(3)
  revokedAt  DateTime? @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model RefreshToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @db.Uuid
  tokenHash  String    @unique
  expiresAt  DateTime  @db.Timestamptz(3)
  revokedAt  DateTime? @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, revokedAt])
  @@index([expiresAt])
}
```

Before using this draft, validate it with the selected Prisma version and its corresponding project configuration. The schema shown here intentionally contains only the four models; generator and datasource configuration belong to the complete Prisma setup.

---

## 12. Migration Strategy

Prisma Migrate shall manage database schema changes.

The initial process will be:

1. Configure the Prisma project and database connection securely.
2. Finalize the model definitions.
3. Validate the schema using the selected Prisma CLI.
4. Generate the initial development migration.
5. Review the generated migration.
6. Apply the migration to the intended NeonDB development database.
7. Test that the resulting tables, foreign keys, unique constraints, and indexes exist as intended.
8. Commit the Prisma schema and migration files to version control.

Development schema changes shall use the appropriate Prisma development migration workflow. Deployment shall apply reviewed migrations rather than changing production schema ad hoc.

Prisma's configuration and migration commands must follow the installed Prisma version. In Prisma ORM v7, database connection URLs are configured through the Prisma config file rather than the `datasource.url` property in `schema.prisma`.

Production database credentials must never be committed to Git.

---

## 13. Data Integrity and Transactions

The backend shall use database transactions where several data changes represent one logical operation.

Examples include:

- Verifying an email and consuming its verification token.
- Changing a password and consuming the reset token.
- Rotating a refresh token and revoking the previous record.
- Revoking active refresh tokens after a successful password reset.

Unique constraints must protect against concurrent duplicate registrations.

The application must handle transaction conflicts and expected uniqueness errors without returning internal database details to the frontend.

---

## 14. Retention and Cleanup

Expired and consumed token records may accumulate over time.

The initial implementation does not require a complex scheduling service.

A later cleanup operation shall remove expired or consumed verification and password-reset token records once they are no longer required.

Refresh-token records must be retained long enough to support the chosen reuse-detection policy. Expired or revoked refresh-token records may be deleted after the retention period required by that policy.

The cleanup mechanism must not delete records that are still needed for active authentication or security checks.

---

## 15. Exclusions

The initial database design does not include:

- A persisted terms-acceptance record.
- Social authentication account models.
- Role or permission tables.
- A separate access-token table.
- A separate user-profile table.
- An email-provider configuration table.
- A general-purpose session model.

These may be introduced later if the product requirements change.

---

## 16. Definition of Done

The database design is ready for implementation when:

- All persistent entities have been identified.
- Required fields and data types are specified.
- Relationships and foreign keys are documented.
- Unique constraints and indexes are identified.
- Token expiration, use, and revocation behavior is clear.
- Database transaction requirements are documented.
- The proposed Prisma schema has been validated against the selected Prisma version.
- The migration strategy is understood.

The next stage is to initialize the backend workspace, configure Prisma, and validate the model draft before creating the first database migration.