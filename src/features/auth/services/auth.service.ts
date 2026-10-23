import type { AuthResult, LoginInput, PasswordResetInput, RegisterInput } from "../types/auth.types";
export interface AuthService { login(input:LoginInput):Promise<AuthResult>; register(input:RegisterInput):Promise<AuthResult>; requestPasswordReset(input:PasswordResetInput):Promise<AuthResult>; }
