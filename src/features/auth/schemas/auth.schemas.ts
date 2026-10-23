import { z } from "zod";
export const loginSchema=z.object({email:z.string().email("Enter a valid email address."),password:z.string().min(1,"Enter your password."),rememberMe:z.boolean()});
export const signupSchema=z.object({fullName:z.string().trim().min(2,"Enter your full name."),email:z.string().email("Enter a valid email address."),password:z.string().min(8,"Use at least 8 characters.").regex(/[A-Z]/,"Include an uppercase letter.").regex(/[0-9]/,"Include a number."),confirmPassword:z.string(),terms:z.boolean().refine((value)=>value,{message:"Please accept the terms to continue."})}).refine((d)=>d.password===d.confirmPassword,{message:"Passwords do not match.",path:["confirmPassword"]});
export const resetSchema=z.object({email:z.string().email("Enter a valid email address.")});
export type LoginForm=z.infer<typeof loginSchema>; export type SignupForm=z.infer<typeof signupSchema>; export type ResetForm=z.infer<typeof resetSchema>;
