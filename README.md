# Northstar authentication frontend

A frontend-only Next.js App Router authentication experience. It uses TypeScript, Tailwind CSS, React Hook Form, Zod, Lucide icons, and Sonner notifications. No database, server action, API route, token, or client-side credential persistence is included.

## Routes

- `/` redirects to `/login`
- `/login` validates and demonstrates sign-in
- `/signup` validates name, email, password complexity, confirmation, and terms
- `/forgot-password` demonstrates a reset request without claiming email delivery

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
npm run lint
npx tsc --noEmit
```

## Structure

`src/app/(auth)` contains route composition, `src/components/auth` contains shared presentation controls, and `src/features/auth` owns schemas, types, forms, and service adapters. Brand settings and the future public API base URL are centralized in `src/config/site.ts`.

## Backend integration

Forms only call `demoAuthService` from `src/features/auth/services/auth.demo.ts`. Replace that export with a fetch-backed implementation of `AuthService` from `auth.service.ts`; do not change the form components. Use `NEXT_PUBLIC_API_BASE_URL` (configured in `.env.local`) as the centralized base URL. Keep database credentials, JWT secrets, and every backend-only secret out of public environment variables.

Expected request contracts:

```ts
POST /auth/login { email: string; password: string; rememberMe: boolean }
POST /auth/register { fullName: string; email: string; password: string }
POST /auth/password-reset { email: string }
// Suggested response: { message: string }
```

The demo adapter only delays and returns explanatory messages. It never stores users, creates sessions/tokens, or sends emails. Backend validation and all security controls remain required after integration.
