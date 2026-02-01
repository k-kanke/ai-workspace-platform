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
  const newPane = useCallback(async () => {
    const ws = await createWorkspace(null);
    const th = await createThread(ws.id, null);
    ensureSaved(ws.id, th.id);
    addPane(ws.id, th.id);
  }, [addPane, ensureSaved]);
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
  return { panes, saved, setPanes, setSaved, addPane, ensureSaved, newPane, closePane, focusPane, openSaved } as const;
}

export default function WorkspacesPage() {
  const { panes, saved, setPanes, ensureSaved, newPane, closePane, focusPane, openSaved } = useOpenPanes();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [threadsByWs, setThreadsByWs] = useState<Record<number, Thread[]>>({});
  const [loadingWs, setLoadingWs] = useState<Set<number>>(new Set());

  useEffect(() => {
    // load workspaces on mount
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

  // Do not auto-open a workspace on load; user explicitly opens via sidebar

  return (
    <div className="h-screen overflow-hidden bg-zinc-100">
      <AppHeader onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
      <div className="mx-auto max-w-[1400px] px-4 flex gap-4 h-[calc(100vh-49px)] overflow-hidden">
        {sidebarOpen && (
          <Sidebar
            panes={panes}
            saved={saved}
            workspaces={workspaces}
            expanded={expanded}
            threadsByWs={threadsByWs}
            loadingWs={loadingWs}
            onNewPane={newPane}
            onClosePane={closePane}
            onFocus={focusPane}
            onOpenSaved={openSaved}
            onToggleWs={toggleWs}
            onLoadThreads={loadThreads}
            onOpenThread={openThread}
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
    </div>
  );
}
