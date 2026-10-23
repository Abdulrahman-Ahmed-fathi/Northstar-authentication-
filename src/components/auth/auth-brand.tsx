import { Compass } from "lucide-react";
import { siteConfig } from "@/config/site";
export function AuthBrand({ light = false }: { light?: boolean }) { return <div className={`flex items-center gap-2.5 ${light ? "text-white" : "text-slate-900"}`}><span className="grid size-9 place-items-center rounded-xl bg-[var(--brand)] text-white shadow-sm"><Compass size={19} strokeWidth={2.5}/></span><span className="text-lg font-semibold tracking-tight">{siteConfig.name}</span></div>; }
