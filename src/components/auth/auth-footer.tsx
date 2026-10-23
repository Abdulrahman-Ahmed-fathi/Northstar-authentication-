import Link from "next/link";
export function AuthFooter({ question, href, action }: {question:string;href:string;action:string}) { return <p className="mt-7 text-center text-sm text-slate-500">{question} <Link href={href} className="font-medium text-[var(--brand)] hover:text-[var(--brand-dark)] hover:underline">{action}</Link></p>; }
