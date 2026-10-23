import type { Metadata } from "next"; import { AuthCard } from "@/components/auth/auth-card"; import { LoginForm } from "@/features/auth/components/login-form";
export const metadata:Metadata={title:"Sign in"}; export default function LoginPage(){return <AuthCard title="Welcome back" description="Sign in to continue where you left off."><LoginForm/></AuthCard>}
