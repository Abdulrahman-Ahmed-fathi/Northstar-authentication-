import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
export const metadata: Metadata = { title: { default: "Northstar", template: "%s · Northstar" }, description: "The calm, focused workspace for ambitious teams." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Toaster richColors position="top-right" />{children}</body></html>; }
