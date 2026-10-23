import type { AuthService } from "./auth.service";
const pause=()=>new Promise<void>((resolve)=>setTimeout(resolve,700));
/** Demo only. Replace with a fetch-based AuthService implementation when Express endpoints exist. */
export const demoAuthService:AuthService={async login(){await pause();return {message:"Demo sign-in complete. Connect your API to authenticate real users."};},async register(){await pause();return {message:"Demo account request complete. No account was created."};},async requestPasswordReset(){await pause();return {message:"Demo request received. No email was sent."};}};
