const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export type Workspace = { id: number; name: string | null; created_at?: string };
export type Thread = { id: number; workspace_id: number; title?: string | null; created_at?: string };
export type Message = { id: number; thread_id: number; role: "user" | "assistant"; content: string; created_at: string };
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type Run = { id: number; thread_id: number; status: RunStatus; created_at?: string; updated_at?: string };

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let err: any = undefined;
    try { err = await res.json(); } catch { /* noop */ }
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function createWorkspace(name?: string | null): Promise<Workspace> {
  return http<Workspace>(`/workspace`, {
    method: "POST",
    body: JSON.stringify({ name: name ?? null }),
  });
}

export async function createThread(workspace_id: number, title?: string | null): Promise<Thread> {
  return http<Thread>(`/threads`, {
    method: "POST",
    body: JSON.stringify({ workspace_id, title: title ?? null }),
  });
}

export async function listMessages(threadId: number): Promise<Message[]> {
  return http<Message[]>(`/threads/${threadId}/messages`);
}

export async function postMessage(threadId: number, content: string): Promise<Run> {
  return http<Run>(`/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function getRun(runId: number): Promise<Run> {
  return http<Run>(`/runs/${runId}`);
}

