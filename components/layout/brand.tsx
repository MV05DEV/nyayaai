import Link from "next/link";

export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${light ? "text-white" : "text-slate-900"}`}><span className="grid size-9 place-items-center rounded-xl bg-blue-700 text-sm font-bold text-white">N</span><span>NyayaAI</span></Link>;
}
