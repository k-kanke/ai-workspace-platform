"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message, Run, RunStatus, Thread, Workspace } from "@/lib/api";
import { createThread, createWorkspace, listMessages, postMessage } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

function useLocalIds() {
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [threadId, setThreadId] = useState<number | null>(null);

  useEffect(() => {
    const ws = localStorage.getItem("ws_id");
    const th = localStorage.getItem("thread_id");
    if (ws) setWorkspaceId(Number(ws));
    if (th) setThreadId(Number(th));
  }, []);

  const save = useCallback((ws: number, th: number) => {
    localStorage.setItem("ws_id", String(ws));
    localStorage.setItem("thread_id", String(th));
    setWorkspaceId(ws);
    setThreadId(th);
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem("ws_id");
    localStorage.removeItem("thread_id");
    setWorkspaceId(null);
    setThreadId(null);
  }, []);

  return { workspaceId, threadId, save, clear } as const;
}

export default function ChatPage() {
  const { workspaceId, threadId, save, clear } = useLocalIds();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingRun, setPendingRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const [assistantDraft, setAssistantDraft] = useState<string>("");

  // lazy bootstrap: create workspace/thread if missing
  async function initThreadManually() {
    setError(null);
    setInitializing(true);
    try {
      const ws: Workspace = await createWorkspace(null);
      const th: Thread = await createThread(ws.id, null);
      save(ws.id, th.id);
    } catch (e: any) {
      setError(e?.message || "初期化に失敗しました");
    } finally {
      setInitializing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function ensureThread() {
      if (workspaceId && threadId) return;
      setInitializing(true);
      try {
        const ws: Workspace = await createWorkspace(null);
        const th: Thread = await createThread(ws.id, null);
        if (!cancelled) save(ws.id, th.id);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "初期化に失敗しました");
      } finally {
        // 初期化中フラグは常に解除（依存の変化でキャンセルされても解除する）
        setInitializing(false);
      }
    }
    ensureThread();
    return () => { cancelled = true; };
  }, [workspaceId, threadId, save]);

  // fetch messages when thread ready
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
  }, [threadId, pendingRun?.status]);

  // cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
    };
  }, []);

  const onSend = useCallback(async () => {
    if (!threadId || !input.trim()) return;
    setError(null);
    try {
      const run = await postMessage(threadId, input.trim());
      setPendingRun(run);
      setInput("");

      // close previous stream if any
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      setAssistantDraft("");

      const es = new EventSource(`${API_BASE}/runs/${run.id}/stream`);
      esRef.current = es;
      es.addEventListener("status", (e) => {
        try {
          const s = (e as MessageEvent).data as RunStatus;
          setPendingRun((prev) => (prev ? { ...prev, status: s } : prev));
        } catch {}
      });
      es.addEventListener("message", (e) => {
        const data = (e as MessageEvent).data as string;
        setAssistantDraft(data);
      });
      es.addEventListener("done", async () => {
        es.close();
        esRef.current = null;
        // refresh messages once for consistency
        if (threadId) {
          try {
            const msgs = await listMessages(threadId);
            setMessages(msgs);
          } catch {}
        }
        setAssistantDraft("");
        setPendingRun((prev) => (prev ? { ...prev, status: "succeeded" } as Run : prev));
      });
      es.onerror = () => {
        // best-effort close on error
        try { es.close(); } catch {}
        esRef.current = null;
      };
    } catch (e: any) {
      setError(e?.message || "送信に失敗しました");
    }
  }, [threadId, input]);

  const statusBadge = useMemo(() => {
    const s = pendingRun?.status;
    if (!s) return null;
    const cls = s === "succeeded" ? "bg-green-100 text-green-700" : s === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700";
    return (
      <span className={`px-2 py-1 rounded text-xs ${cls}`}>
        run: {s}
      </span>
    );
  }, [pendingRun?.status]);

  return (
    <div className="mx-auto max-w-2xl p-6 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Chat</h1>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">workspace:</span>
        <span>{workspaceId ?? "-"}</span>
        <span className="text-zinc-500 ml-3">thread:</span>
        <span>{threadId ?? "-"}</span>
        <div className="ml-auto">{statusBadge}</div>
      </div>

      <div className="border rounded p-3 min-h-40 bg-white">
        {messages.length === 0 && (
          <div className="text-sm text-zinc-500">メッセージはまだありません。</div>
        )}
        <ul className="flex flex-col gap-2">
          {messages.map((m) => (
            <li key={m.id} className="text-sm">
              <span className="font-mono mr-2 text-zinc-500">[{m.role}]</span>
              <span>{m.content}</span>
            </li>
          ))}
          {assistantDraft && (
            <li className="text-sm opacity-80">
              <span className="font-mono mr-2 text-zinc-500">[assistant]</span>
              <span>{assistantDraft}</span>
            </li>
          )}
        </ul>
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm"
          placeholder="メッセージを入力..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
          autoFocus
          // 入力は常に可能にする（送信可否はボタン側で制御）
        />
        <button
          className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
          onClick={onSend}
          disabled={!threadId || !input.trim() || initializing}
        >
          Send
        </button>
      </div>

      {!threadId && (
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <span>スレッド未初期化です。</span>
          <button
            className="px-2 py-1 rounded border"
            onClick={initThreadManually}
            disabled={initializing}
          >
            手動で初期化
          </button>
        </div>
      )}

      <div className="text-xs text-zinc-500">API: {API_BASE}</div>

      <div className="text-xs text-zinc-500">
        状態: {initializing ? "初期化中" : "待機中"}
      </div>
    </div>
  );
}
