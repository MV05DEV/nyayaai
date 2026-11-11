"use client";

import { useEffect, useState } from "react";

type CaseItem = { id: string; title: string; description: string };
type Generated = { id?: string; title: string; content: string };

export function DocumentGenerator() {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [caseId, setCaseId] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const [generated, setGenerated] = useState<Generated>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && !cases.length) {
      fetch("/api/case")
        .then(response => response.ok ? response.json() : [])
        .then((items: CaseItem[]) => { setCases(Array.isArray(items) ? items : []); if (items[0]) setCaseId(items[0].id); })
        .catch(() => setError("Could not load saved cases."));
    }
  }, [open, cases.length]);

  async function generate() {
    setLoading(true); setError(""); setDownloaded(false);
    try {
      const response = await fetch("/api/documents/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType: "REFUND_REQUEST", caseId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate the document.");
      setGenerated({ id: data.id, title: data.title, content: data.content });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not generate the document."); }
    finally { setLoading(false); }
  }

  async function downloadPdf() {
    if (!generated) return;
    setError("");
    try {
      const response = await fetch("/api/documents/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(generated) });
      if (!response.ok) throw new Error("Could not export the document as PDF.");
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl; anchor.download = "nyayaai-refund-request.pdf"; anchor.click();
      URL.revokeObjectURL(blobUrl); setDownloaded(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "PDF export failed."); }
  }

  return <div className="fixed bottom-5 right-5 z-20">
    <button onClick={() => setOpen(value => !value)} className="rounded-full bg-blue-800 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-900">Documents</button>
    {open && <section className="mb-3 w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Generate a refund request</h2><button onClick={() => setOpen(false)} aria-label="Close documents" className="text-slate-500">×</button></div>
      <label className="mt-4 block text-sm text-slate-600">Saved case<select value={caseId} onChange={event => setCaseId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2"><option value="">Choose a case</option>{cases.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {!cases.length && <p className="mt-3 text-xs text-slate-500">Create a conversation first to save a case.</p>}
      <button onClick={generate} disabled={!caseId || loading} className="mt-3 w-full rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">{loading ? "Preparing…" : "Generate document"}</button>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {generated && <>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Review and edit complaint preview<textarea aria-label="Complaint preview" value={generated.content} onChange={event => { setGenerated({ ...generated, content: event.target.value }); setDownloaded(false); }} rows={19} className="mt-2 max-h-[55vh] min-h-80 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 font-serif text-sm leading-6 text-black" /></label>
        <button onClick={downloadPdf} className="mt-3 block w-full rounded-lg border border-blue-200 px-3 py-2.5 text-center text-sm font-semibold text-blue-800">Download PDF</button>
        {downloaded && <p className="mt-2 text-center text-xs text-emerald-700">PDF downloaded</p>}
      </>}
    </section>}
  </div>;
}
