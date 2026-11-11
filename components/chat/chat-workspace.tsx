"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { AssistantMessage } from "@/components/chat/assistant-message";
import { acquireChatRequest, chatErrorMessage, deferChatRequest, prepareChatSubmission, releaseChatRequest } from "@/lib/chat/submission.mjs";

type Turn = { role: "user" | "assistant"; content: string };
type CaseItem = { id: string; title: string; description: string; createdAt: string };
type Source = { title: string; sourceTitle: string; sectionReference: string; sourceUrl: string };

const suggestions = ["I received a defective product.", "My refund has not been processed.", "My online order was never delivered.", "A company is refusing to provide a service."];
const welcome = "Hello! I'm NyayaAI. Tell me what happened, and I'll help you understand your options and prepare the next steps.";

export function ChatWorkspace() {
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", content: welcome }]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [caseId, setCaseId] = useState<string>();
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedMessage, setFailedMessage] = useState("");
  const [retryCooldown, setRetryCooldown] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [mobileHistory, setMobileHistory] = useState(false);
  const [busyCaseId, setBusyCaseId] = useState<string>();
  const [clearingCases, setClearingCases] = useState(false);
  const [cleanupNotice, setCleanupNotice] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const requestGateRef = useRef({ inFlight: false, nextAllowedAt: 0 });

  useEffect(() => {
    fetch("/api/case").then(response => response.ok ? response.json() : []).then((data: CaseItem[]) => setCases(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, loading]);
  useEffect(() => {
    if (retryCooldown <= 0) return;
    const timer = window.setTimeout(() => setRetryCooldown(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retryCooldown]);

  function newConversation() {
    setCaseId(undefined);
    setTurns([{ role: "assistant", content: welcome }]);
    setSources([]);
    setDisclaimer("");
    setError("");
    setFailedMessage("");
    setMobileHistory(false);
  }

  async function openCase(item: CaseItem) {
    setCaseId(item.id);
    setError("");
    setFailedMessage("");
    try {
      const response = await fetch(`/api/case/${item.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load conversation.");
      setTurns([{ role: "assistant", content: welcome }, ...(data.messages || []).filter((message: Turn) => message.role === "user" || message.role === "assistant").map((message: Turn) => ({ role: message.role, content: message.content }))]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load conversation."); }
    setMobileHistory(false);
  }

  async function deleteCase(item: CaseItem) {
    const prompt = `Delete “${item.title}” and all its saved messages, evidence, and generated documents? This cannot be undone.`;
    if (busyCaseId || clearingCases || !window.confirm(prompt)) return;
    setBusyCaseId(item.id); setCleanupNotice("");
    try {
      const response = await fetch(`/api/case/${item.id}`, { method: "DELETE", headers: { "x-nyayaai-cleanup-confirm": "delete-conversation" } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete conversation.");
      setCases(previous => previous.filter(itemCase => itemCase.id !== item.id));
      if (caseId === item.id) newConversation();
      setCleanupNotice("Conversation deleted.");
    } catch (cause) { setCleanupNotice(cause instanceof Error ? cause.message : "Could not delete conversation."); }
    finally { setBusyCaseId(undefined); }
  }

  async function clearAllCases() {
    const prompt = "Are you sure? This will permanently delete all saved conversations, messages, evidence and generated documents. This action cannot be undone.";
    if (clearingCases || busyCaseId || !cases.length || !window.confirm(prompt)) return;
    setClearingCases(true); setCleanupNotice("");
    try {
      const response = await fetch("/api/case", { method: "DELETE", headers: { "x-nyayaai-cleanup-confirm": "clear-all-conversations" } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not clear conversations.");
      setCases([]);
      newConversation();
      setCleanupNotice("All conversations deleted.");
    } catch (cause) { setCleanupNotice(cause instanceof Error ? cause.message : "Could not clear conversations."); }
    finally { setClearingCases(false); }
  }

  async function send(event?: FormEvent, suggested?: string, retry = false) {
    event?.preventDefault();
    const text = (retry ? failedMessage : suggested ?? input).trim();
    if (!text || loading || !acquireChatRequest(requestGateRef.current)) return;
    const submission = prepareChatSubmission(turns, text, retry);
    if (submission.shouldAppendUserTurn) setTurns(previous => [...previous, { role: "user", content: text }]);
    if (!retry) setInput("");
    setError(""); setLoading(true);
    try {
      let activeCaseId = caseId;
      if (!activeCaseId) {
        const created = await fetch("/api/case", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: text.slice(0, 80), description: text }) });
        const saved = await created.json();
        if (created.ok && typeof saved.id === "string") { activeCaseId = saved.id; setCaseId(saved.id); setCases(old => [saved, ...old]); }
      }
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: submission.messages, language, ...(activeCaseId ? { caseId: activeCaseId } : {}) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFailedMessage(text);
        if (payload.code === "RATE_LIMITED") {
          const waitSeconds = typeof payload.retryAfterSeconds === "number" ? payload.retryAfterSeconds : 2;
          deferChatRequest(requestGateRef.current, waitSeconds);
          setRetryCooldown(Math.max(2, Math.ceil(waitSeconds)));
        }
        setError(chatErrorMessage(payload.code));
        return;
      }
      const answer = typeof payload.message === "string" ? payload.message : typeof payload.content === "string" ? payload.content : "";
      if (!answer.trim()) {
        setFailedMessage(text);
        setError(chatErrorMessage());
        return;
      }
      setTurns(previous => [...previous, { role: "assistant", content: answer }]);
      setFailedMessage("");
      setSources(Array.isArray(payload.legalSourcesUsed) ? payload.legalSourcesUsed : []);
      setDisclaimer(typeof payload.disclaimer === "string" ? payload.disclaimer : "");
      if (activeCaseId) await Promise.all(["user", "assistant"].map((role, index) => fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: activeCaseId, role, content: index === 0 ? text : answer }) })));
    } catch {
      setFailedMessage(text);
      setError(chatErrorMessage());
    } finally { releaseChatRequest(requestGateRef.current); setLoading(false); }
  }

  return <div className="flex h-dvh bg-white text-slate-900">
    <aside className={`${mobileHistory ? "fixed inset-0 z-30 flex" : "hidden"} w-full flex-col border-r border-slate-200 bg-slate-50 p-4 md:relative md:flex md:w-[280px] md:shrink-0`}>
      <div className="flex items-center justify-between"><Brand/><button onClick={() => setMobileHistory(false)} className="rounded-md p-2 text-slate-500 md:hidden" aria-label="Close history">×</button></div>
      <button onClick={newConversation} className="mt-8 flex items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-900">＋ New conversation</button>
      <div className="mt-6 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recent cases</p>{cases.length > 0 && <button onClick={clearAllCases} disabled={clearingCases || !!busyCaseId} className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50">{clearingCases ? "Clearing…" : "Clear all"}</button>}</div>
      <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">{cases.length ? cases.map(item => <div key={item.id} className={`group flex items-center rounded-lg pr-1 ${caseId === item.id ? "bg-white text-blue-900 shadow-sm" : "text-slate-600 hover:bg-white"}`}><button onClick={() => openCase(item)} className="min-w-0 flex-1 px-3 py-3 text-left text-sm"><span className="block truncate font-medium">{item.title}</span><span className="mt-1 block text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span></button><button onClick={() => deleteCase(item)} disabled={!!busyCaseId || clearingCases} aria-label={`Delete ${item.title}`} title="Delete conversation" className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">{busyCaseId === item.id ? "…" : <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round"/></svg>}</button></div>) : <p className="text-sm leading-6 text-slate-500">Your saved cases will appear here.</p>}</div>
      {cleanupNotice && <p role="status" className="mt-3 text-xs text-slate-600">{cleanupNotice}</p>}
      <Link href="/" className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-500 hover:text-blue-800">← Back to home</Link>
    </aside>
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-[65px] shrink-0 items-center justify-between border-b border-slate-100 px-4 sm:px-7"><div className="flex items-center gap-3"><button onClick={() => setMobileHistory(true)} className="rounded-md p-2 text-slate-600 md:hidden" aria-label="Open history">☰</button><span className="font-medium text-slate-800">Legal assistant</span></div><label className="flex items-center gap-2 text-xs text-slate-500">Language<select aria-label="Language" value={language} onChange={event => setLanguage(event.target.value as "en" | "hi")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700"><option value="en">English</option><option value="hi">हिन्दी</option></select></label></header>
      <div className="flex-1 overflow-y-auto"><div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10"><div className="mb-8 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-slate-700"><strong className="text-slate-900">A note on privacy:</strong> Share only the details needed to explain your issue. Avoid passwords, payment card numbers and other sensitive account information.</div>
        <div className="space-y-7">{turns.map((turn, index) => <div key={`${index}-${turn.role}`} className={`flex gap-3 ${turn.role === "user" ? "justify-end" : "justify-start"}`}>{turn.role === "assistant" && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-800 text-xs font-bold text-white">N</span>}<div className={`max-w-[88%] rounded-2xl px-4 py-3.5 text-sm ${turn.role === "user" ? "whitespace-pre-wrap rounded-br-md bg-blue-800 leading-6 text-white" : "rounded-tl-md border border-slate-200 bg-white leading-7 text-slate-700"}`}>{turn.role === "assistant" ? <AssistantMessage content={turn.content}/> : turn.content}</div></div>)}{loading && <div className="flex items-center gap-3 text-sm text-slate-500"><span className="grid size-8 place-items-center rounded-lg bg-blue-800 text-xs font-bold text-white">N</span><span className="animate-pulse">Preparing a response…</span></div>}</div>
        {turns.length === 1 && <div className="mt-8"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">You could ask</p><div className="grid gap-2 sm:grid-cols-2">{suggestions.map(suggestion => <button key={suggestion} onClick={() => send(undefined, suggestion)} className="rounded-xl border border-slate-200 p-3.5 text-left text-sm text-slate-600 transition hover:border-blue-300 hover:bg-blue-50/40">{suggestion}<span className="float-right text-slate-400">↗</span></button>)}</div></div>}
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}{failedMessage && <button type="button" onClick={() => void send(undefined, undefined, true)} disabled={loading || retryCooldown > 0} className="ml-3 font-semibold underline underline-offset-2 disabled:opacity-50">{retryCooldown > 0 ? `Retry message (${retryCooldown}s)` : "Retry message"}</button>}</div>}
        {sources.length > 0 && <section className="mt-8 rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold">Retrieved legal sources</h2><ul className="mt-3 space-y-2">{sources.map((source, index) => <li key={`${source.sourceUrl}-${index}`} className="text-sm"><a className="text-blue-800 underline decoration-blue-200 underline-offset-2 hover:decoration-blue-700" href={source.sourceUrl} target="_blank" rel="noreferrer">{source.title || source.sourceTitle}{source.sectionReference ? ` · ${source.sectionReference}` : ""}</a></li>)}</ul></section>}
        {disclaimer && <p className="mt-6 text-xs leading-5 text-slate-500">{disclaimer}</p>}<div ref={endRef}/>
      </div></div>
      <form onSubmit={event => void send(event)} className="shrink-0 border-t border-slate-100 bg-white px-4 py-4 sm:px-8"><div className="mx-auto max-w-3xl"><div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Tell me what happened…" rows={1} maxLength={5000} className="max-h-32 min-h-11 flex-1 resize-y bg-transparent px-2 py-3 text-sm leading-5 outline-none placeholder:text-slate-400" aria-label="Your message"/><button disabled={loading || !input.trim()} className="rounded-lg bg-blue-800 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-slate-300">{loading ? "Sending…" : "Send"}</button></div><p className="mt-2 text-center text-[11px] text-slate-400">AI-generated information can be incomplete. This is not legal advice.</p></div></form>
    </main>
  </div>;
}
