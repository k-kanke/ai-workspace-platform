"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import Sidebar, { OpenPane, SavedItem } from "@/components/Sidebar";
import {
  createKnowledge,
  deleteWorkspace,
  deleteThread,
  linkWorkspaceKnowledge,
  listKnowledge,
  listThreadsByWorkspace,
  listWorkspaceKnowledgeLinks,
  listWorkspaces,
  updateKnowledge,
  updateThreadTitle,
  updateWorkspaceName,
  updateWorkspaceSystemPrompt,
  unlinkWorkspaceKnowledge,
  Workspace,
  Thread,
  Knowledge,
} from "@/lib/api";
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

  const addPane = useCallback((wsId: number, thId: number, wsName?: string | null, thTitle?: string | null) => {
    setPanes((prev) => {
      if (prev.length >= 3) return prev;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return [...prev, { id, workspaceId: wsId, threadId: thId, workspaceName: wsName ?? null, threadTitle: thTitle ?? null }];
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
  const openSaved = useCallback((wsId: number, thId: number, wsName?: string | null, thTitle?: string | null) => {
    addPane(wsId, thId, wsName, thTitle);
  }, [addPane]);
  return { panes, saved, setPanes, setSaved, addPane, ensureSaved, closePane, openSaved } as const;
}

export default function WorkspacesPage() {
  const { panes, setPanes, ensureSaved, closePane, openSaved } = useOpenPanes();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [threadsByWs, setThreadsByWs] = useState<Record<number, Thread[]>>({});
  const [loadingWs, setLoadingWs] = useState<Set<number>>(new Set());
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceSystemPrompt, setNewWorkspaceSystemPrompt] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadWs, setNewThreadWs] = useState<number | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false);
  const [editingSystemPromptWs, setEditingSystemPromptWs] = useState<number | null>(null);
  const [systemPromptValue, setSystemPromptValue] = useState("");
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [editingKnowledgeWs, setEditingKnowledgeWs] = useState<number | null>(null);
  const [knowledgeList, setKnowledgeList] = useState<Knowledge[]>([]);
  const [knowledgeSelectedId, setKnowledgeSelectedId] = useState<number | null>(null);
  const [knowledgeEditorValue, setKnowledgeEditorValue] = useState("");
  const [knowledgeLinkedIds, setKnowledgeLinkedIds] = useState<Set<number>>(new Set());
  const [showKnowledgeWorkspaceSelect, setShowKnowledgeWorkspaceSelect] = useState(false);
  const [showRenameWorkspaceModal, setShowRenameWorkspaceModal] = useState(false);
  const [renameWorkspaceId, setRenameWorkspaceId] = useState<number | null>(null);
  const [renameWorkspaceValue, setRenameWorkspaceValue] = useState("");
  const [showRenameThreadModal, setShowRenameThreadModal] = useState(false);
  const [renameThreadId, setRenameThreadId] = useState<number | null>(null);
  const [renameThreadWsId, setRenameThreadWsId] = useState<number | null>(null);
  const [renameThreadValue, setRenameThreadValue] = useState("");
  const [showDeleteWorkspaceModal, setShowDeleteWorkspaceModal] = useState(false);
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState<number | null>(null);
  const [showDeleteThreadModal, setShowDeleteThreadModal] = useState(false);
  const [deleteThreadId, setDeleteThreadId] = useState<number | null>(null);
  const [deleteThreadWsId, setDeleteThreadWsId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try { setWorkspaces(await listWorkspaces()); } catch {}
    })();
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const onPaneReady = useCallback((idx: number, wsId: number, thId: number, wsName?: string | null, thTitle?: string | null) => {
    setPanes((prev) => prev.map((p, i) => i === idx ? { ...p, workspaceId: wsId, threadId: thId, workspaceName: wsName ?? null, threadTitle: thTitle ?? null } : p));
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
    setNewWorkspaceSystemPrompt("");
  }, []);

  const closeSystemPromptModal = useCallback(() => {
    setShowSystemPromptModal(false);
    setEditingSystemPromptWs(null);
    setSystemPromptValue("");
  }, []);

  const closeKnowledgeModal = useCallback(() => {
    setShowKnowledgeModal(false);
    setEditingKnowledgeWs(null);
    setKnowledgeSelectedId(null);
    setKnowledgeEditorValue("");
    setShowKnowledgeWorkspaceSelect(false);
  }, []);

  const closeRenameWorkspaceModal = useCallback(() => {
    setShowRenameWorkspaceModal(false);
    setRenameWorkspaceId(null);
    setRenameWorkspaceValue("");
  }, []);

  const closeRenameThreadModal = useCallback(() => {
    setShowRenameThreadModal(false);
    setRenameThreadId(null);
    setRenameThreadWsId(null);
    setRenameThreadValue("");
  }, []);

  const closeDeleteWorkspaceModal = useCallback(() => {
    setShowDeleteWorkspaceModal(false);
    setDeleteWorkspaceId(null);
  }, []);

  const closeDeleteThreadModal = useCallback(() => {
    setShowDeleteThreadModal(false);
    setDeleteThreadId(null);
    setDeleteThreadWsId(null);
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
    const wsName = workspaces.find(w => w.id === wsId)?.name ?? null;
    const thTitle = (threadsByWs[wsId] || []).find(t => t.id === thId)?.title ?? null;
    openSaved(wsId, thId, wsName, thTitle);
  }, [openSaved, threadsByWs, workspaces]);

  const openNewThreadModal = useCallback((wsId: number) => {
    setNewThreadWs(wsId);
    setNewThreadTitle("");
    setShowNewThread(true);
  }, []);

  const openSystemPromptModal = useCallback((wsId: number) => {
    const ws = workspaces.find((w) => w.id === wsId);
    setEditingSystemPromptWs(wsId);
    setSystemPromptValue(ws?.system_prompt ?? "");
    setShowSystemPromptModal(true);
  }, [workspaces]);

  const loadKnowledgeList = useCallback(async () => {
    try {
      const items = await listKnowledge();
      setKnowledgeList(items);
    } catch {}
  }, []);

  const loadKnowledgeLinks = useCallback(async (wsId: number | null) => {
    if (!wsId) {
      setKnowledgeLinkedIds(new Set());
      return;
    }
    try {
      const items = await listWorkspaceKnowledgeLinks(wsId);
      setKnowledgeLinkedIds(new Set(items.map((k) => k.id)));
    } catch {}
  }, []);

  const openKnowledgeModal = useCallback(async (wsId: number) => {
    setEditingKnowledgeWs(wsId);
    setKnowledgeSelectedId(null);
    setKnowledgeEditorValue("");
    setShowKnowledgeWorkspaceSelect(false);
    setShowKnowledgeModal(true);
    await loadKnowledgeList();
    await loadKnowledgeLinks(wsId);
  }, [loadKnowledgeList, loadKnowledgeLinks]);

  const openKnowledgeTab = useCallback(async () => {
    const wsId = workspaces[0]?.id ?? null;
    setEditingKnowledgeWs(wsId);
    setKnowledgeSelectedId(null);
    setKnowledgeEditorValue("");
    setShowKnowledgeWorkspaceSelect(true);
    setShowKnowledgeModal(true);
    await loadKnowledgeList();
    await loadKnowledgeLinks(wsId);
  }, [workspaces, loadKnowledgeList, loadKnowledgeLinks]);

  const openRenameWorkspace = useCallback((wsId: number) => {
    const ws = workspaces.find((w) => w.id === wsId);
    setRenameWorkspaceId(wsId);
    setRenameWorkspaceValue(ws?.name ?? "");
    setShowRenameWorkspaceModal(true);
  }, [workspaces]);

  const openRenameThread = useCallback((wsId: number, thId: number) => {
    const t = (threadsByWs[wsId] || []).find((th) => th.id === thId);
    setRenameThreadId(thId);
    setRenameThreadWsId(wsId);
    setRenameThreadValue(t?.title ?? "");
    setShowRenameThreadModal(true);
  }, [threadsByWs]);

  const openDeleteWorkspace = useCallback((wsId: number) => {
    setDeleteWorkspaceId(wsId);
    setShowDeleteWorkspaceModal(true);
  }, []);

  const openDeleteThread = useCallback((wsId: number, thId: number) => {
    setDeleteThreadWsId(wsId);
    setDeleteThreadId(thId);
    setShowDeleteThreadModal(true);
  }, []);
  // Do not auto-open a workspace on load; user explicitly opens via sidebar

  return (
    <div className="h-screen overflow-hidden bg-zinc-100">
      <AppHeader onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} onNewThread={() => { setShowNewThread(true); setNewThreadWs(workspaces[0]?.id ?? null); }} />
      <div className="mx-auto max-w-350 px-4 flex gap-4 h-[calc(100vh-49px)] overflow-hidden">
        {sidebarOpen && (
          <Sidebar
            panes={panes}
            workspaces={workspaces}
            expanded={expanded}
            threadsByWs={threadsByWs}
            loadingWs={loadingWs}
            onNewPane={() => setShowNewWorkspace(true)}
            onToggleWs={toggleWs}
            onLoadThreads={loadThreads}
            onOpenThread={openThread}
            onCreateThread={openNewThreadModal}
            onEditSystemPrompt={openSystemPromptModal}
            onEditKnowledge={openKnowledgeModal}
            onOpenKnowledgeTab={openKnowledgeTab}
            onRenameWorkspace={openRenameWorkspace}
            onRenameThread={openRenameThread}
            onDeleteWorkspace={openDeleteWorkspace}
            onDeleteThread={openDeleteThread}
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
                    initialWorkspaceName={p.workspaceName}
                    initialThreadTitle={p.threadTitle}
                    onReady={(ws, th, wsName, thTitle) => onPaneReady(idx, ws, th, wsName, thTitle)}
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
                      const wsName = workspaces.find(w => w.id === newThreadWs)?.name ?? null;
                      openSaved(newThreadWs, th.id, wsName, th.title ?? null);
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
                  const systemPrompt = newWorkspaceSystemPrompt.trim() || null;
                  const ws = await createWorkspace(name, systemPrompt);
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
              <label className="text-xs text-zinc-600">System prompt (optional)</label>
              <textarea
                className="border border-zinc-200 rounded-md px-2 py-2 text-sm min-h-32"
                placeholder="e.g. You are a helpful assistant..."
                value={newWorkspaceSystemPrompt}
                onChange={(e) => setNewWorkspaceSystemPrompt(e.target.value)}
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
      {showSystemPromptModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={closeSystemPromptModal}>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-lg w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-3">Edit System Prompt</div>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingSystemPromptWs) return;
                try {
                  const next = systemPromptValue.trim();
                  const ws = await updateWorkspaceSystemPrompt(editingSystemPromptWs, next ? next : null);
                  setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, system_prompt: ws.system_prompt ?? null } : w)));
                  closeSystemPromptModal();
                } catch {}
              }}
            >
              <textarea
                className="border border-zinc-200 rounded-md px-2 py-2 text-sm min-h-40"
                placeholder="System prompt"
                value={systemPromptValue}
                onChange={(e) => setSystemPromptValue(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-200" type="button" onClick={closeSystemPromptModal}>Cancel</button>
                <button className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white" type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showKnowledgeModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={closeKnowledgeModal}>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-lg w-full max-w-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-3">Knowledge</div>
            <div className="flex flex-col gap-3">
              {showKnowledgeWorkspaceSelect && (
                <>
                  <label className="text-xs text-zinc-600">Workspace</label>
                  <select
                    className="border border-zinc-200 rounded-md px-2 py-2 text-sm"
                    value={editingKnowledgeWs ?? ""}
                    onChange={async (e) => {
                      const wsId = Number(e.target.value) || null;
                      setEditingKnowledgeWs(wsId);
                      await loadKnowledgeLinks(wsId);
                    }}
                  >
                    {workspaces.length === 0 && <option value="">No workspace</option>}
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name || `Workspace ${ws.id}`}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <div className="grid grid-cols-3 gap-4 min-h-72">
                <div className="col-span-1 border border-zinc-200 rounded-md p-2 overflow-auto">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-zinc-600">Knowledge List</div>
                    <button
                      className="text-xs px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-50"
                      onClick={() => {
                        setKnowledgeSelectedId(null);
                        setKnowledgeEditorValue("");
                      }}
                    >
                      New
                    </button>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {knowledgeList.map((k) => {
                      const linked = knowledgeLinkedIds.has(k.id);
                      const active = knowledgeSelectedId === k.id;
                      return (
                        <li key={`k-${k.id}`}>
                          <button
                            className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-zinc-50 ${active ? "bg-zinc-100" : ""}`}
                            onClick={() => {
                              setKnowledgeSelectedId(k.id);
                              setKnowledgeEditorValue(k.content);
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">#{k.id} {k.content.slice(0, 18) || "Untitled"}</span>
                              {linked && <span className="text-[10px] text-green-700">linked</span>}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                    {knowledgeList.length === 0 && (
                      <li className="text-[11px] text-zinc-400 px-2 py-1">No knowledge</li>
                    )}
                  </ul>
                </div>
                <div className="col-span-2 flex flex-col gap-2">
                  <label className="text-xs text-zinc-600">Content</label>
                  <textarea
                    className="border border-zinc-200 rounded-md px-2 py-2 text-sm min-h-48"
                    placeholder="Knowledge text"
                    value={knowledgeEditorValue}
                    onChange={(e) => setKnowledgeEditorValue(e.target.value)}
                  />
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 disabled:opacity-50"
                        disabled={!editingKnowledgeWs || !knowledgeSelectedId}
                        onClick={async () => {
                          if (!editingKnowledgeWs || !knowledgeSelectedId) return;
                          try {
                            await linkWorkspaceKnowledge(editingKnowledgeWs, knowledgeSelectedId);
                            setKnowledgeLinkedIds((prev) => new Set(prev).add(knowledgeSelectedId));
                          } catch {}
                        }}
                      >
                        Link
                      </button>
                      <button
                        className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 disabled:opacity-50"
                        disabled={!editingKnowledgeWs || !knowledgeSelectedId}
                        onClick={async () => {
                          if (!editingKnowledgeWs || !knowledgeSelectedId) return;
                          try {
                            await unlinkWorkspaceKnowledge(editingKnowledgeWs, knowledgeSelectedId);
                            setKnowledgeLinkedIds((prev) => {
                              const next = new Set(prev);
                              next.delete(knowledgeSelectedId);
                              return next;
                            });
                          } catch {}
                        }}
                      >
                        Unlink
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-200" type="button" onClick={closeKnowledgeModal}>Close</button>
                      <button
                        className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white disabled:opacity-50"
                        disabled={!knowledgeEditorValue.trim()}
                        onClick={async () => {
                          const next = knowledgeEditorValue.trim();
                          if (!next) return;
                          try {
                            if (knowledgeSelectedId) {
                              const updated = await updateKnowledge(knowledgeSelectedId, next);
                              setKnowledgeList((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
                            } else {
                              const created = await createKnowledge(next);
                              setKnowledgeList((prev) => [created, ...prev]);
                              setKnowledgeSelectedId(created.id);
                            }
                          } catch {}
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showRenameWorkspaceModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={closeRenameWorkspaceModal}>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-lg w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-3">Rename Workspace</div>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!renameWorkspaceId) return;
                const next = renameWorkspaceValue.trim();
                if (!next) return;
                try {
                  const ws = await updateWorkspaceName(renameWorkspaceId, next);
                  setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, name: ws.name ?? null } : w)));
                  setPanes((prev) => prev.map((p) => (p.workspaceId === ws.id ? { ...p, workspaceName: ws.name ?? null } : p)));
                  closeRenameWorkspaceModal();
                } catch {}
              }}
            >
              <label className="text-xs text-zinc-600">Name</label>
              <input
                className="border border-zinc-200 rounded-md px-2 py-2 text-sm"
                placeholder="e.g. Marketing"
                value={renameWorkspaceValue}
                onChange={(e) => setRenameWorkspaceValue(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-200" type="button" onClick={closeRenameWorkspaceModal}>Cancel</button>
                <button className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white" type="submit" disabled={!renameWorkspaceValue.trim()}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showRenameThreadModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={closeRenameThreadModal}>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-lg w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-3">Rename Thread</div>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!renameThreadId || !renameThreadWsId) return;
                const next = renameThreadValue.trim();
                if (!next) return;
                try {
                  const th = await updateThreadTitle(renameThreadId, next);
                  setThreadsByWs((prev) => ({
                    ...prev,
                    [renameThreadWsId]: (prev[renameThreadWsId] || []).map((t) => (t.id === th.id ? { ...t, title: th.title ?? null } : t)),
                  }));
                  setPanes((prev) => prev.map((p) => (p.threadId === th.id ? { ...p, threadTitle: th.title ?? null } : p)));
                  closeRenameThreadModal();
                } catch {}
              }}
            >
              <label className="text-xs text-zinc-600">Title</label>
              <input
                className="border border-zinc-200 rounded-md px-2 py-2 text-sm"
                placeholder="e.g. Investigation"
                value={renameThreadValue}
                onChange={(e) => setRenameThreadValue(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-200" type="button" onClick={closeRenameThreadModal}>Cancel</button>
                <button className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white" type="submit" disabled={!renameThreadValue.trim()}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDeleteWorkspaceModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={closeDeleteWorkspaceModal}>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-lg w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-3 text-red-600">Delete Workspace</div>
            <div className="text-sm text-zinc-700">
              ワークスペースを削除したらワークスペース内のスレッドも全て消えます。それでもよろしいでしょうか？
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-200" type="button" onClick={closeDeleteWorkspaceModal}>Cancel</button>
              <button
                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white"
                type="button"
                onClick={async () => {
                  if (!deleteWorkspaceId) return;
                  const wsId = deleteWorkspaceId;
                  const prevWorkspaces = workspaces;
                  const prevThreadsByWs = threadsByWs;
                  const prevExpanded = expanded;
                  const prevPanes = panes;
                  closeDeleteWorkspaceModal();
                  setWorkspaces((prev) => prev.filter((w) => w.id !== wsId));
                  setThreadsByWs((prev) => {
                    const next = { ...prev };
                    delete next[wsId];
                    return next;
                  });
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    next.delete(wsId);
                    return next;
                  });
                  setPanes((prev) => prev.filter((p) => p.workspaceId !== wsId));
                  try {
                    await deleteWorkspace(wsId);
                  } catch {
                    setWorkspaces(prevWorkspaces);
                    setThreadsByWs(prevThreadsByWs);
                    setExpanded(prevExpanded);
                    setPanes(prevPanes);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteThreadModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={closeDeleteThreadModal}>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-lg w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-3 text-red-600">Delete Thread</div>
            <div className="text-sm text-zinc-700">
              スレッドを削除してもよろしいでしょうか？
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-200" type="button" onClick={closeDeleteThreadModal}>Cancel</button>
              <button
                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white"
                type="button"
                onClick={async () => {
                  if (!deleteThreadId || !deleteThreadWsId) return;
                  const thId = deleteThreadId;
                  const wsId = deleteThreadWsId;
                  const prevThreadsByWs = threadsByWs;
                  const prevPanes = panes;
                  closeDeleteThreadModal();
                  setThreadsByWs((prev) => ({
                    ...prev,
                    [wsId]: (prev[wsId] || []).filter((t) => t.id !== thId),
                  }));
                  setPanes((prev) => prev.filter((p) => p.threadId !== thId));
                  try {
                    await deleteThread(thId);
                  } catch {
                    setThreadsByWs(prevThreadsByWs);
                    setPanes(prevPanes);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
