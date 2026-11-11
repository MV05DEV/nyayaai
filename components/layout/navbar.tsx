import Link from "next/link";
import { Brand } from "@/components/layout/brand";

export function Navbar() {
  return <header className="border-b border-slate-100 bg-white"><nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6"><Brand /><div className="hidden items-center gap-8 text-sm text-slate-600 md:flex"><a href="#how-it-works" className="hover:text-blue-700">How it works</a><a href="#features" className="hover:text-blue-700">What you can do</a><a href="#safety" className="hover:text-blue-700">Our approach</a></div><Link href="/chat" className="rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900">Start your case <span aria-hidden="true">→</span></Link></nav></header>;
}
