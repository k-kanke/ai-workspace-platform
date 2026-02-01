"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import Sidebar, { OpenPane } from "@/components/Sidebar";
import WorkspacePane from "@/components/WorkspacePane";
import { createThread, createWorkspace } from "@/lib/api";

type PaneState = OpenPane;

function useOpenPanes() {
  const [panes, setPanes] = useState<PaneState[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("open_panes");
      if (raw) setPanes(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("open_panes", JSON.stringify(panes));
  }, [panes]);

  const addPane = useCallback((wsId: number, thId: number) => {
    setPanes((prev) => {
      if (prev.length >= 3) return prev;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return [...prev, { id, workspaceId: wsId, threadId: thId }];
    });
  }, []);
  const newPane = useCallback(async () => {
    const ws = await createWorkspace(null);
    const th = await createThread(ws.id, null);
    addPane(ws.id, th.id);
  }, [addPane]);
  const closePane = useCallback((id: string) => {
    setPanes((prev) => prev.filter(p => p.id !== id));
  }, []);
  const focusPane = useCallback((_id: string) => {
    // MVP: no-op, panes are always visible
  }, []);
  return { panes, setPanes, addPane, newPane, closePane, focusPane } as const;
}

export default function WorkspacesPage() {
  const { panes, setPanes, addPane, newPane, closePane, focusPane } = useOpenPanes();

  const onPaneReady = useCallback((idx: number, wsId: number, thId: number) => {
    setPanes((prev) => prev.map((p, i) => i === idx ? { ...p, workspaceId: wsId, threadId: thId } : p));
  }, [setPanes]);

  const gridCols = useMemo(() => {
    const n = Math.max(1, Math.min(3, panes.length || 3));
    return n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-3";
  }, [panes.length]);

  // Do not auto-open a workspace on load; user explicitly opens via sidebar

  return (
    <div className="h-screen overflow-hidden bg-zinc-100">
      <AppHeader />
      <div className="mx-auto max-w-[1400px] px-4 flex gap-4 h-[calc(100vh-49px)] overflow-hidden">
        <Sidebar panes={panes} onNewPane={newPane} onClosePane={closePane} onFocus={focusPane} />
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
