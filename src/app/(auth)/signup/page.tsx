import type { Metadata } from "next"; import { AuthCard } from "@/components/auth/auth-card"; import { SignupForm } from "@/features/auth/components/signup-form";
export const metadata:Metadata={title:"Create your account"}; export default function SignupPage(){return <AuthCard title="Create your account" description="Start bringing your team’s work into focus."><SignupForm/></AuthCard>}
