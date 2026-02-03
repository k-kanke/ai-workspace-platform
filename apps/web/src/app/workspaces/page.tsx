"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import Sidebar, { OpenPane, SavedItem } from "@/components/Sidebar";
import { listThreadsByWorkspace, listWorkspaces, Workspace, Thread } from "@/lib/api";
import WorkspacePane from "@/components/WorkspacePane";
import { createThread, createWorkspace } from "@/lib/api";

type PaneState = OpenPane;

function useOpenPanes() {
  const [panes, setPanes] = useState<PaneState[]>([]);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("open_panes");
      if (raw) setPanes(JSON.parse(raw));
      const rawSaved = localStorage.getItem("saved_threads");
      if (rawSaved) setSaved(JSON.parse(rawSaved));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("open_panes", JSON.stringify(panes));
  }, [panes]);
  useEffect(() => {
    localStorage.setItem("saved_threads", JSON.stringify(saved));
  }, [saved]);

  const addPane = useCallback((wsId: number, thId: number) => {
    setPanes((prev) => {
      if (prev.length >= 3) return prev;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return [...prev, { id, workspaceId: wsId, threadId: thId }];
    });
  }, []);
  const ensureSaved = useCallback((wsId: number, thId: number) => {
    setSaved((prev) => prev.some(s => s.threadId === thId) ? prev : [...prev, { workspaceId: wsId, threadId: thId }]);
  }, []);
  const closePane = useCallback((id: string) => {
    setPanes((prev) => {
      const closing = prev.find(p => p.id === id);
      if (closing) {
        ensureSaved(closing.workspaceId, closing.threadId);
      }
      return prev.filter(p => p.id !== id);
    });
  }, [ensureSaved]);
  const focusPane = useCallback((_id: string) => {
    // MVP: no-op, panes are always visible
  }, []);
  const openSaved = useCallback((wsId: number, thId: number) => {
    addPane(wsId, thId);
  }, [addPane]);
  return { panes, saved, setPanes, setSaved, addPane, ensureSaved, closePane, focusPane, openSaved } as const;
}

export default function WorkspacesPage() {
  const { panes, saved, setPanes, addPane, ensureSaved, closePane, focusPane, openSaved } = useOpenPanes();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [threadsByWs, setThreadsByWs] = useState<Record<number, Thread[]>>({});
  const [loadingWs, setLoadingWs] = useState<Set<number>>(new Set());
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadWs, setNewThreadWs] = useState<number | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState("");

  useEffect(() => {
    (async () => {
      try { setWorkspaces(await listWorkspaces()); } catch {}
    })();
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const onPaneReady = useCallback((idx: number, wsId: number, thId: number) => {
    setPanes((prev) => prev.map((p, i) => i === idx ? { ...p, workspaceId: wsId, threadId: thId } : p));
    ensureSaved(wsId, thId);
  }, [setPanes, ensureSaved]);

  const gridCols = useMemo(() => {
    const n = Math.max(1, Math.min(3, panes.length || 3));
    return n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-3";
  }, [panes.length]);

  const toggleWs = useCallback((wsId: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(wsId)) next.delete(wsId); else next.add(wsId);
      return next;
    });
  }, []);

  const closeNewWorkspace = useCallback(() => {
    setShowNewWorkspace(false);
    setNewWorkspaceName("");
  }, []);

  const loadThreads = useCallback(async (wsId: number) => {
    setLoadingWs(prev => new Set(prev).add(wsId));
    try {
      const items = await listThreadsByWorkspace(wsId);
      setThreadsByWs(prev => ({ ...prev, [wsId]: items }));
    } catch {}
    setLoadingWs(prev => { const n = new Set(prev); n.delete(wsId); return n; });
  }, []);

  const openThread = useCallback((wsId: number, thId: number) => {
    openSaved(wsId, thId);
  }, [openSaved]);

  const createThreadInWorkspace = useCallback(async (wsId: number) => {
    try {
      const th = await createThread(wsId, null);
      // update list cache
      setThreadsByWs(prev => ({ ...prev, [wsId]: [th, ...(prev[wsId] || [])] }));
      // expand and open new thread
      setExpanded(prev => new Set(prev).add(wsId));
      openSaved(wsId, th.id);
    } catch (e) {
      // noop simple failure
    }
  }, [openSaved]);

  // Do not auto-open a workspace on load; user explicitly opens via sidebar

  return (
    <div className="h-screen overflow-hidden bg-zinc-100">
      <AppHeader onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} onNewThread={() => { setShowNewThread(true); setNewThreadWs(workspaces[0]?.id ?? null); }} />
      <div className="mx-auto max-w-[1400px] px-4 flex gap-4 h-[calc(100vh-49px)] overflow-hidden">
        {sidebarOpen && (
          <Sidebar
            panes={panes}
            saved={saved}
            workspaces={workspaces}
            expanded={expanded}
            threadsByWs={threadsByWs}
            loadingWs={loadingWs}
            onNewPane={() => setShowNewWorkspace(true)}
            onClosePane={closePane}
            onFocus={focusPane}
            onOpenSaved={openSaved}
            onToggleWs={toggleWs}
            onLoadThreads={loadThreads}
            onOpenThread={openThread}
            onCreateThread={createThreadInWorkspace}
          />
        )}
        <main className="flex-1 py-3 h-full overflow-hidden">
          <div className={`grid gap-4 ${gridCols} h-full`}>
            {(panes.length ? panes : [null, null, null]).slice(0, 3).map((p, idx) => (
              <div key={p ? p.id : `placeholder-${idx}`} className="border border-zinc-200 rounded-lg bg-white h-full overflow-hidden shadow-sm">
                {p ? (
                  <WorkspacePane
                    initialWorkspaceId={p.workspaceId}
                    initialThreadId={p.threadId}
                    onReady={(ws, th) => onPaneReady(idx, ws, th)}
                    onClose={() => closePane(p.id)}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-400 text-sm">Empty</div>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
      {showNewThread && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowNewThread(false)}>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-lg w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-3">Create Thread</div>
            <div className="flex flex-col gap-3">
              <label className="text-xs text-zinc-600">Workspace</label>
              <select
                className="border border-zinc-200 rounded-md px-2 py-2 text-sm"
                value={newThreadWs ?? ''}
                onChange={(e) => setNewThreadWs(Number(e.target.value) || null)}
              >
                <option value="" disabled>Select workspace</option>
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name || `Workspace ${ws.id}`}</option>
                ))}
              </select>
              <label className="text-xs text-zinc-600">Title (optional)</label>
              <input
                className="border border-zinc-200 rounded-md px-2 py-2 text-sm"
                placeholder="e.g. Investigation"
                value={newThreadTitle}
                onChange={(e) => setNewThreadTitle(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-200" onClick={() => setShowNewThread(false)}>Cancel</button>
                <button
                  className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white disabled:opacity-50"
                  disabled={!newThreadWs}
                  onClick={async () => {
                    if (!newThreadWs) return;
                    try {
                      const th = await createThread(newThreadWs, newThreadTitle || null);
                      setThreadsByWs(prev => ({ ...prev, [newThreadWs]: [th, ...(prev[newThreadWs] || [])] }));
                      setExpanded(prev => new Set(prev).add(newThreadWs));
                      openSaved(newThreadWs, th.id);
                      setShowNewThread(false);
                      setNewThreadTitle('');
                    } catch {}
                  }}
                >Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showNewWorkspace && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={closeNewWorkspace}>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-lg w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-3">Create Workspace</div>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const name = newWorkspaceName.trim() || null;
                  const ws = await createWorkspace(name);
                  setWorkspaces(prev => [ws, ...prev.filter(w => w.id !== ws.id)]);
                  setThreadsByWs(prev => ({ ...prev, [ws.id]: prev[ws.id] || [] }));
                  setExpanded(prev => new Set(prev).add(ws.id));
                  closeNewWorkspace();
                } catch {}
              }}
            >
              <label className="text-xs text-zinc-600">Name (optional)</label>
              <input
                className="border border-zinc-200 rounded-md px-2 py-2 text-sm"
                placeholder="e.g. Marketing"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-200" type="button" onClick={closeNewWorkspace}>Cancel</button>
                <button className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white" type="submit">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
