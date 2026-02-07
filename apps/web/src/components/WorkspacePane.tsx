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
  onEditSystemPrompt,
  onOpenKnowledge,
  onRenameWorkspace,
  onDeleteWorkspace,
  llmEnabled,
  onToggleLLM,
}: {
  initialWorkspaceId?: number;
  initialThreadId?: number;
  initialWorkspaceName?: string | null;
  initialThreadTitle?: string | null;
  onReady: (wsId: number, thId: number, wsName?: string | null, thTitle?: string | null) => void;
  onClose: () => void;
  onEditSystemPrompt?: (wsId: number) => void;
  onOpenKnowledge?: (wsId: number) => void;
  onRenameWorkspace?: (wsId: number) => void;
  onDeleteWorkspace?: (wsId: number) => void;
  llmEnabled?: boolean;
  onToggleLLM?: (wsId: number, enabled: boolean) => void;
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    if (initialWorkspaceId != null && initialWorkspaceId !== workspaceId) {
      setWorkspaceId(initialWorkspaceId);
    }
    if (initialThreadId != null && initialThreadId !== threadId) {
      setThreadId(initialThreadId);
    }
  }, [initialWorkspaceId, initialThreadId, workspaceId, threadId]);

  useEffect(() => {
    setWorkspaceName(initialWorkspaceName ?? null);
  }, [initialWorkspaceName]);

  useEffect(() => {
    setThreadTitle(initialThreadTitle ?? null);
  }, [initialThreadTitle]);

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
    <div className="relative flex flex-col h-full group">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 bg-linear-to-b from-white to-zinc-50">
        <div className="font-medium">{workspaceName || `Workspace ${workspaceId ?? "-"}`}</div>
        <div className="text-sm text-zinc-500">/ {threadTitle || `Thread ${threadId ?? "-"}`}</div>
        <div className="ml-auto">{statusBadge}</div>
        <button
          className={`inline-flex items-center h-5 w-9 rounded-full border transition-colors mr-2 ${llmEnabled ? "bg-emerald-500 border-emerald-600" : "bg-zinc-200 border-zinc-300"}`}
          onClick={() => { if (workspaceId != null) onToggleLLM?.(workspaceId, !llmEnabled); }}
          title={llmEnabled ? "LLM On" : "LLM Off"}
          aria-label={llmEnabled ? "LLM On" : "LLM Off"}
          type="button"
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${llmEnabled ? "translate-x-4" : "translate-x-1"}`} />
        </button>
        <div className="relative">
          <button
            className="ml-0 text-4xl leading-none text-zinc-500 hover:text-zinc-800"
            onClick={() => setSettingsOpen((v) => !v)}
            title="Settings"
            aria-label="Settings"
          >
            ⚙
          </button>
          {settingsOpen && (
            <div
              className="absolute right-0 top-8 z-20 w-44 rounded-md border border-zinc-200 bg-white shadow-lg"
              role="menu"
            >
              <button
                className="w-full text-left text-xs px-3 py-2 hover:bg-zinc-50"
                role="menuitem"
                onClick={() => {
                  if (!workspaceId) return;
                  setSettingsOpen(false);
                  onEditSystemPrompt?.(workspaceId);
                }}
              >
                Edit system prompt
              </button>
              <button
                className="w-full text-left text-xs px-3 py-2 hover:bg-zinc-50 border-t border-zinc-100"
                role="menuitem"
                onClick={() => {
                  if (!workspaceId) return;
                  setSettingsOpen(false);
                  onOpenKnowledge?.(workspaceId);
                }}
              >
                Knowledge
              </button>
              <button
                className="w-full text-left text-xs px-3 py-2 hover:bg-zinc-50 border-t border-zinc-100"
                role="menuitem"
                onClick={() => {
                  if (!workspaceId) return;
                  setSettingsOpen(false);
                  onRenameWorkspace?.(workspaceId);
                }}
              >
                Rename workspace
              </button>
              <button
                className="w-full text-left text-xs px-3 py-2 hover:bg-zinc-50 border-t border-zinc-100 text-red-600"
                role="menuitem"
                onClick={() => {
                  if (!workspaceId) return;
                  setSettingsOpen(false);
                  onDeleteWorkspace?.(workspaceId);
                }}
              >
                Delete workspace
              </button>
            </div>
          )}
        </div>
      </div>
      <button
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-zinc-200 text-sm text-zinc-500 hover:text-red-600 hover:border-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        onClick={onClose}
        title="Close"
        aria-label="Close"
      >
        ×
      </button>
      <div className="flex-1 p-4 overflow-y-auto bg-white">
        {messages.length === 0 && !assistantDraft && (
          <div className="text-sm text-zinc-500">No messages yet</div>
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
          placeholder="message"
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
          Send
        </button>
      </div>
    </div>
  );
}
