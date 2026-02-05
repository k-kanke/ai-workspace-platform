"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message, Run, RunStatus, Thread, Workspace } from "@/lib/api";
import { createThread, createWorkspace, listMessages, postMessage } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export default function WorkspacePane({
  initialWorkspaceId,
  initialThreadId,
  initialWorkspaceName,
  initialThreadTitle,
  onReady,
  onClose,
}: {
  initialWorkspaceId?: number;
  initialThreadId?: number;
  initialWorkspaceName?: string | null;
  initialThreadTitle?: string | null;
  onReady: (wsId: number, thId: number, wsName?: string | null, thTitle?: string | null) => void;
  onClose: () => void;
}) {
  const [workspaceId, setWorkspaceId] = useState<number | null>(initialWorkspaceId ?? null);
  const [threadId, setThreadId] = useState<number | null>(initialThreadId ?? null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(initialWorkspaceName ?? null);
  const [threadTitle, setThreadTitle] = useState<string | null>(initialThreadTitle ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingRun, setPendingRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const [assistantDraft, setAssistantDraft] = useState<string>("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function ensureThread() {
      if (workspaceId && threadId) return;
      setInitializing(true);
      try {
        const ws: Workspace = await createWorkspace(null);
        const th: Thread = await createThread(ws.id, null);
        if (!cancelled) {
          setWorkspaceId(ws.id);
          setThreadId(th.id);
          setWorkspaceName(ws.name ?? null);
          setThreadTitle(th.title ?? null);
          onReady(ws.id, th.id, ws.name ?? null, th.title ?? null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "初期化に失敗しました");
      } finally {
        setInitializing(false);
      }
    }
    ensureThread();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!threadId) return;
      try {
        const msgs = await listMessages(threadId);
        if (!cancelled) setMessages(msgs);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "メッセージ取得に失敗しました");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [threadId]);

  useEffect(() => () => { if (esRef.current) { esRef.current.close(); esRef.current = null; } }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const cs = window.getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight || '20');
    const pad = parseFloat(cs.paddingTop || '0') + parseFloat(cs.paddingBottom || '0');
    const brd = parseFloat(cs.borderTopWidth || '0') + parseFloat(cs.borderBottomWidth || '0');
    const base = lh + pad + brd; // 1 row
    const maxPx = lh * 4 + pad + brd; // 4 rows

    ta.style.height = 'auto';

    if (!input) {
      ta.style.height = `${base}px`;
      ta.style.overflowY = 'hidden';
      return;
    }

    const need = ta.scrollHeight;
    const newH = Math.max(base, Math.min(need, maxPx));
    ta.style.height = `${newH}px`;
    ta.style.overflowY = need > maxPx ? 'auto' : 'hidden';
  }, [input]);

  const onSend = useCallback(async () => {
    if (!threadId || !input.trim() || pendingRun) return;
    setError(null);
    const content = input.trim();
    setInput("");
    const tempId = Math.random();
    setMessages((prev) => [...prev, { id: tempId as any, thread_id: threadId, role: "user", content, created_at: new Date().toISOString() } as Message]);
    try {
      const run = await postMessage(threadId, content);
      setPendingRun(run);

      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      setAssistantDraft("");
      const es = new EventSource(`${API_BASE}/runs/${run.id}/stream`);
      esRef.current = es;
      es.addEventListener("status", (e) => {
        try { const s = (e as MessageEvent).data as RunStatus; setPendingRun((prev) => (prev ? { ...prev, status: s } : prev)); } catch {}
      });
      es.addEventListener("message", (e) => { const data = (e as MessageEvent).data as string; setAssistantDraft(data); });
      es.addEventListener("done", async () => {
        es.close(); esRef.current = null;
        if (threadId) {
          try { const msgs = await listMessages(threadId); setMessages(msgs); } catch {}
        }
        setAssistantDraft("");
        setPendingRun(null);
      });
      es.onerror = async () => {
        try { es.close(); } catch {}
        esRef.current = null;
        if (threadId) {
          try { const msgs = await listMessages(threadId); setMessages(msgs); } catch {}
        }
        setAssistantDraft("");
        setPendingRun(null);
      };
    } catch (e: any) {
      setError(e?.message || "送信に失敗しました");
    }
  }, [threadId, input, pendingRun]);

  const statusBadge = useMemo(() => {
    const s = pendingRun?.status;
    if (!s) return null;
    const cls = s === "succeeded" ? "bg-green-100 text-green-700" : s === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700";
    return (
      <span className={`px-2 py-1 rounded text-xs ${cls}`}>run: {s}</span>
    );
  }, [pendingRun?.status]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 bg-linear-to-b from-white to-zinc-50">
        <div className="font-medium">{workspaceName || `Workspace ${workspaceId ?? "-"}`}</div>
        <div className="text-sm text-zinc-500">/ {threadTitle || `Thread ${threadId ?? "-"}`}</div>
        <div className="ml-auto">{statusBadge}</div>
        <button className="ml-2 text-sm text-zinc-500 hover:text-red-600" onClick={onClose}>×</button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto bg-white">
        {messages.length === 0 && !assistantDraft && (
          <div className="text-sm text-zinc-500">メッセージはまだありません。</div>
        )}
        <ul className="flex flex-col gap-3">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <li key={`${m.id}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap wrap-break-words ${isUser ? "bg-zinc-900 text-white rounded-br-sm" : "bg-zinc-100 text-zinc-900 rounded-bl-sm"}`}>
                  {m.content}
                </div>
              </li>
            );
          })}
          {assistantDraft && (
            <li className="flex justify-start">
              <div className="max-w-[80%] px-3 py-2 rounded-2xl text-sm bg-zinc-100 text-zinc-900 rounded-bl-sm opacity-80 shadow-sm whitespace-pre-wrap wrap-break-words">
                {assistantDraft}
              </div>
            </li>
          )}
        </ul>
      </div>
      <div className="border-t border-zinc-200 px-3 py-2 bg-white flex gap-2 items-end">
        <textarea
          className="flex-1 border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-none"
          placeholder="..."
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={!threadId}
          ref={taRef}
        />
        <button
          className="px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-sm disabled:opacity-50"
          onClick={onSend}
          disabled={!threadId || !input.trim() || initializing || !!pendingRun}
        >
          送信
        </button>
      </div>
    </div>
  );
}
