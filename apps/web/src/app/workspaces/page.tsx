"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import Sidebar, { OpenPane, TabItem } from "@/components/Sidebar";
import {
  createKnowledge,
  deleteWorkspace,
  deleteThread,
  getWorkspaceKnowledge,
  linkWorkspaceKnowledge,
  unlinkWorkspaceKnowledge,
  listKnowledge,
  listThreadsByWorkspace,
  listWorkspaces,
  updateKnowledge,
  updateThreadTitle,
  updateWorkspaceLLMEnabled,
  updateWorkspaceName,
  updateWorkspaceSystemPrompt,
  Workspace,
  Thread,
  Knowledge,
} from "@/lib/api";
import WorkspacePane from "@/components/WorkspacePane";
import { createThread, createWorkspace } from "@/lib/api";

type PaneState = OpenPane;
type TabState = TabItem;

function useOpenPanes() {
  const [panes, setPanes] = useState<PaneState[]>([]);
  const [tabs, setTabs] = useState<TabState[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("open_panes");
      if (raw) setPanes(JSON.parse(raw));
      const rawTabs = localStorage.getItem("open_tabs");
      if (rawTabs) {
        setTabs(JSON.parse(rawTabs));
      } else {
        const rawSaved = localStorage.getItem("saved_threads");
        if (rawSaved) setTabs(JSON.parse(rawSaved));
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("open_panes", JSON.stringify(panes));
  }, [panes]);
  useEffect(() => {
    localStorage.setItem("open_tabs", JSON.stringify(tabs));
  }, [tabs]);

  const upsertTab = useCallback((wsId: number, thId: number, wsName?: string | null, thTitle?: string | null) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.threadId === thId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], workspaceId: wsId, workspaceName: wsName ?? null, threadTitle: thTitle ?? null };
        return next;
      }
      return [...prev, { workspaceId: wsId, threadId: thId, workspaceName: wsName ?? null, threadTitle: thTitle ?? null }];
    });
  }, []);

  const openInPane = useCallback((wsId: number, thId: number, wsName?: string | null, thTitle?: string | null) => {
    setPanes((prev) => {
      const now = Date.now();
      const existingIdx = prev.findIndex((p) => p.threadId === thId);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], workspaceId: wsId, workspaceName: wsName ?? null, threadTitle: thTitle ?? null, lastActiveAt: now };
        return next;
      }
      if (prev.length < 3) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        return [...prev, { id, workspaceId: wsId, threadId: thId, workspaceName: wsName ?? null, threadTitle: thTitle ?? null, lastActiveAt: now }];
      }
      let oldestIdx = 0;
      let oldestTs = prev[0]?.lastActiveAt ?? 0;
      for (let i = 1; i < prev.length; i++) {
        const ts = prev[i]?.lastActiveAt ?? 0;
        if (ts < oldestTs) {
          oldestTs = ts;
          oldestIdx = i;
        }
      }
      const next = [...prev];
      next[oldestIdx] = { ...next[oldestIdx], workspaceId: wsId, threadId: thId, workspaceName: wsName ?? null, threadTitle: thTitle ?? null, lastActiveAt: now };
      return next;
    });
  }, []);
  const closePane = useCallback((id: string) => {
    setPanes((prev) => {
      return prev.filter(p => p.id !== id);
    });
  }, []);
  return { panes, setPanes, tabs, setTabs, upsertTab, openInPane, closePane } as const;
}

export default function WorkspacesPage() {
  const { panes, setPanes, tabs, setTabs, upsertTab, openInPane, closePane } = useOpenPanes();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [threadsByWs, setThreadsByWs] = useState<Record<number, Thread[]>>({});
  const [loadingWs, setLoadingWs] = useState<Set<number>>(new Set());
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceSystemPrompt, setNewWorkspaceSystemPrompt] = useState("");
  const [newWorkspaceKnowledgeId, setNewWorkspaceKnowledgeId] = useState<number | null>(null);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadWs, setNewThreadWs] = useState<number | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false);
  const [editingSystemPromptWs, setEditingSystemPromptWs] = useState<number | null>(null);
  const [systemPromptValue, setSystemPromptValue] = useState("");
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [knowledgeList, setKnowledgeList] = useState<Knowledge[]>([]);
  const [knowledgeSelectedId, setKnowledgeSelectedId] = useState<number | null>(null);
  const [knowledgeNameValue, setKnowledgeNameValue] = useState("");
  const [knowledgeEditorValue, setKnowledgeEditorValue] = useState("");
  const [knowledgeEditMode, setKnowledgeEditMode] = useState(false);
  const [knowledgeContextWsId, setKnowledgeContextWsId] = useState<number | null>(null);
  const [knowledgeCurrentId, setKnowledgeCurrentId] = useState<number | null>(null);
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
    const now = Date.now();
    setPanes((prev) => prev.map((p, i) => i === idx ? { ...p, workspaceId: wsId, threadId: thId, workspaceName: wsName ?? null, threadTitle: thTitle ?? null, lastActiveAt: now } : p));
    upsertTab(wsId, thId, wsName, thTitle);
  }, [setPanes, upsertTab]);

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
    setNewWorkspaceKnowledgeId(null);
  }, []);

  const closeSystemPromptModal = useCallback(() => {
    setShowSystemPromptModal(false);
    setEditingSystemPromptWs(null);
    setSystemPromptValue("");
  }, []);

  const closeKnowledgeModal = useCallback(() => {
    setShowKnowledgeModal(false);
    setKnowledgeSelectedId(null);
    setKnowledgeNameValue("");
    setKnowledgeEditorValue("");
    setKnowledgeEditMode(false);
    setKnowledgeContextWsId(null);
    setKnowledgeCurrentId(null);
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

  const toggleWorkspaceLLM = useCallback(async (wsId: number, enabled: boolean) => {
    try {
      const ws = await updateWorkspaceLLMEnabled(wsId, enabled);
      setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, llm_enabled: ws.llm_enabled } : w)));
    } catch {}
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
    upsertTab(wsId, thId, wsName, thTitle);
    openInPane(wsId, thId, wsName, thTitle);
  }, [openInPane, upsertTab, threadsByWs, workspaces]);

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

  const openKnowledgeModal = useCallback(async () => {
    setKnowledgeSelectedId(null);
    setKnowledgeNameValue("");
    setKnowledgeEditorValue("");
    setKnowledgeEditMode(false);
    setKnowledgeContextWsId(null);
    setKnowledgeCurrentId(null);
    setShowKnowledgeModal(true);
    await loadKnowledgeList();
  }, [loadKnowledgeList]);

  const openKnowledgeTab = useCallback(async () => {
    setKnowledgeSelectedId(null);
    setKnowledgeNameValue("");
    setKnowledgeEditorValue("");
    setKnowledgeEditMode(false);
    setKnowledgeContextWsId(null);
    setKnowledgeCurrentId(null);
    setShowKnowledgeModal(true);
    await loadKnowledgeList();
  }, [loadKnowledgeList]);

  const openWorkspaceKnowledge = useCallback(async (wsId: number) => {
    setKnowledgeSelectedId(null);
    setKnowledgeNameValue("");
    setKnowledgeEditorValue("");
    setKnowledgeEditMode(false);
    setKnowledgeContextWsId(wsId);
    setKnowledgeCurrentId(null);
    setShowKnowledgeModal(true);
    await loadKnowledgeList();
    try {
      const k = await getWorkspaceKnowledge(wsId);
      setKnowledgeCurrentId(k.knowledge_id ?? null);
    } catch {}
  }, [loadKnowledgeList]);

  useEffect(() => {
    if (!knowledgeContextWsId) return;
    if (!knowledgeCurrentId) return;
    if (knowledgeSelectedId) return;
    const current = knowledgeList.find((x) => x.id === knowledgeCurrentId);
    if (current) {
      setKnowledgeSelectedId(current.id);
      setKnowledgeNameValue(current.name ?? "");
      setKnowledgeEditorValue(current.content ?? "");
    }
  }, [knowledgeContextWsId, knowledgeCurrentId, knowledgeList, knowledgeSelectedId]);

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

  const closeTab = useCallback((threadId: number) => {
    setTabs((prev) => prev.filter((t) => t.threadId !== threadId));
    setPanes((prev) => prev.filter((p) => p.threadId !== threadId));
  }, [setTabs, setPanes]);
  // Do not auto-open a workspace on load; user explicitly opens via sidebar

  return (
    <div className="h-screen overflow-hidden bg-zinc-100">
      <AppHeader onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
      <div className="mx-auto max-w-350 px-4 flex gap-4 h-[calc(100vh-49px)] overflow-hidden">
        {sidebarOpen && (
          <Sidebar
            panes={panes}
            workspaces={workspaces}
            expanded={expanded}
            threadsByWs={threadsByWs}
            loadingWs={loadingWs}
            onNewPane={() => { setShowNewWorkspace(true); loadKnowledgeList(); }}
            onToggleWs={toggleWs}
            onLoadThreads={loadThreads}
            onOpenThread={openThread}
            onCreateThread={openNewThreadModal}
            onEditSystemPrompt={openSystemPromptModal}
            onEditKnowledge={(wsId) => { openWorkspaceKnowledge(wsId); }}
            onOpenKnowledgeTab={openKnowledgeTab}
            onNewThread={() => { setShowNewThread(true); setNewThreadWs(workspaces[0]?.id ?? null); }}
            onRenameWorkspace={openRenameWorkspace}
            onRenameThread={openRenameThread}
            onDeleteWorkspace={openDeleteWorkspace}
            onDeleteThread={openDeleteThread}
          />
        )}
        <main className="flex-1 py-3 h-full overflow-hidden flex flex-col min-h-0">
          {tabs.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto">
              {tabs.map((t) => {
                const isOpen = panes.some((p) => p.threadId === t.threadId);
                const title = t.threadTitle || `Thread ${t.threadId}`;
                return (
                  <div
                    key={`tab-${t.threadId}`}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs cursor-pointer ${
                      isOpen ? "border-zinc-800 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                    title={`${t.workspaceName || `Workspace ${t.workspaceId}`} / ${title}`}
                    onClick={() => openInPane(t.workspaceId, t.threadId, t.workspaceName, t.threadTitle)}
                  >
                    <span className="truncate max-w-48">{title}</span>
                    <button
                      className={`text-[11px] ${isOpen ? "text-white/80 hover:text-white" : "text-zinc-400 hover:text-zinc-700"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(t.threadId);
                      }}
                      aria-label="Close tab"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className={`grid gap-4 ${gridCols} flex-1 min-h-0`}>
            {(panes.length ? panes : [null, null, null]).slice(0, 3).map((p, idx) => (
              <div key={p ? `${p.id}-${p.threadId}` : `placeholder-${idx}`} className="border border-zinc-200 rounded-lg bg-white h-full overflow-visible shadow-sm min-h-0 relative">
                {p ? (
                  <WorkspacePane
                    initialWorkspaceId={p.workspaceId}
                    initialThreadId={p.threadId}
                    initialWorkspaceName={p.workspaceName}
                    initialThreadTitle={p.threadTitle}
                    onReady={(ws, th, wsName, thTitle) => onPaneReady(idx, ws, th, wsName, thTitle)}
                    onClose={() => closePane(p.id)}
                    onEditSystemPrompt={openSystemPromptModal}
                    onOpenKnowledge={openWorkspaceKnowledge}
                    onRenameWorkspace={openRenameWorkspace}
                    onDeleteWorkspace={openDeleteWorkspace}
                    llmEnabled={workspaces.find((w) => w.id === p.workspaceId)?.llm_enabled ?? true}
                    onToggleLLM={toggleWorkspaceLLM}
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
                      upsertTab(newThreadWs, th.id, wsName, th.title ?? null);
                      openInPane(newThreadWs, th.id, wsName, th.title ?? null);
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
                  if (newWorkspaceKnowledgeId) {
                    await linkWorkspaceKnowledge(ws.id, newWorkspaceKnowledgeId);
                  }
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
              <label className="text-xs text-zinc-600">Knowledge (optional)</label>
              <select
                className="border border-zinc-200 rounded-md px-2 py-2 text-sm"
                value={newWorkspaceKnowledgeId ?? ""}
                onChange={(e) => setNewWorkspaceKnowledgeId(Number(e.target.value) || null)}
              >
                <option value="">No knowledge</option>
                {knowledgeList.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
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
          <div className="bg-white rounded-lg border border-zinc-200 shadow-lg w-full max-w-5xl h-[80vh] p-4 pb-16 overflow-hidden flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-3">Knowledge</div>
            <div className="flex-1 min-h-0">
              <div className="grid grid-cols-3 gap-4 h-full min-h-0">
                <div className="col-span-1 border border-zinc-200 rounded-md p-2 overflow-auto h-full min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-zinc-600">Knowledge List</div>
                    <button
                      className="text-xs px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-50"
                      onClick={() => {
                        setKnowledgeSelectedId(null);
                        setKnowledgeNameValue("");
                        setKnowledgeEditorValue("");
                        setKnowledgeEditMode(true);
                      }}
                    >
                      + New
                    </button>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {knowledgeList.map((k) => {
                      const active = knowledgeSelectedId === k.id;
                      const current = knowledgeCurrentId === k.id;
                      return (
                        <li key={`k-${k.id}`}>
                          <button
                            className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-zinc-50 ${active ? "bg-zinc-100 ring-1 ring-zinc-300" : ""}`}
                            onClick={() => {
                              setKnowledgeSelectedId(k.id);
                              setKnowledgeNameValue(k.name ?? "");
                              setKnowledgeEditorValue(k.content);
                              setKnowledgeEditMode(false);
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{k.name}</span>
                              {current && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                  Set
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate">
                              {k.content.slice(0, 30) || "No content"}
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
                <div className="col-span-2 h-full min-h-0">
                  <div className="flex flex-col gap-2 h-full min-h-0">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-500">
                        {knowledgeContextWsId ? "Workspace Knowledge" : "Details"}
                      </div>
                      {knowledgeEditMode && (
                        <div className="text-[11px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                          Editing
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {knowledgeContextWsId && knowledgeSelectedId && knowledgeSelectedId !== knowledgeCurrentId && !knowledgeEditMode && (
                          <button
                            className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={async () => {
                              if (!knowledgeContextWsId || !knowledgeSelectedId) return;
                              try {
                                if (knowledgeCurrentId && knowledgeCurrentId !== knowledgeSelectedId) {
                                  await unlinkWorkspaceKnowledge(knowledgeContextWsId, knowledgeCurrentId);
                                }
                                await linkWorkspaceKnowledge(knowledgeContextWsId, knowledgeSelectedId);
                                setKnowledgeCurrentId(knowledgeSelectedId);
                              } catch {}
                            }}
                          >
                            Set as Workspace Knowledge
                          </button>
                        )}
                        <button
                          className={`text-xs px-3 py-1.5 rounded-md border ${knowledgeEditMode ? "border-amber-300 bg-amber-50 text-amber-700" : "border-zinc-200 hover:bg-zinc-50"} disabled:opacity-50`}
                          onClick={() => setKnowledgeEditMode(true)}
                          disabled={!knowledgeSelectedId || knowledgeEditMode}
                        >
                          {knowledgeEditMode ? "Editing" : "Edit"}
                        </button>
                      </div>
                    </div>
                    <label className="text-xs text-zinc-600">Name</label>
                    <input
                    className="border border-zinc-200 rounded-md px-2 py-2 text-sm disabled:bg-zinc-50"
                    placeholder="Knowledge name"
                    value={knowledgeNameValue}
                    onChange={(e) => setKnowledgeNameValue(e.target.value)}
                    disabled={!knowledgeEditMode}
                    />
                    <label className="text-xs text-zinc-600">Content</label>
                    <textarea
                    className="border border-zinc-200 rounded-md px-2 py-2 text-sm flex-1 min-h-0 disabled:bg-zinc-50"
                    placeholder="Knowledge text"
                    value={knowledgeEditorValue}
                    onChange={(e) => setKnowledgeEditorValue(e.target.value)}
                    disabled={!knowledgeEditMode}
                    />
                  </div>
                </div>
              </div>
            </div>
            {!knowledgeEditMode && (
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 bg-white"
                  type="button"
                  onClick={closeKnowledgeModal}
                >
                  Close
                </button>
              </div>
            )}
            {knowledgeEditMode && (
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 bg-white"
                  type="button"
                  onClick={() => {
                    if (knowledgeSelectedId) {
                      const k = knowledgeList.find((x) => x.id === knowledgeSelectedId);
                      setKnowledgeNameValue(k?.name ?? "");
                      setKnowledgeEditorValue(k?.content ?? "");
                    } else {
                      setKnowledgeNameValue("");
                      setKnowledgeEditorValue("");
                    }
                    setKnowledgeEditMode(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white disabled:opacity-50"
                  disabled={!(knowledgeNameValue ?? "").trim() || !knowledgeEditorValue.trim()}
                  onClick={async () => {
                    const name = (knowledgeNameValue ?? "").trim();
                    const next = knowledgeEditorValue.trim();
                    if (!name || !next) return;
                    try {
                      if (knowledgeSelectedId) {
                        const updated = await updateKnowledge(knowledgeSelectedId, name, next);
                        setKnowledgeList((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
                      } else {
                        const created = await createKnowledge(name, next);
                        setKnowledgeList((prev) => [created, ...prev]);
                        setKnowledgeSelectedId(created.id);
                        setKnowledgeNameValue(created.name);
                      }
                      setKnowledgeEditMode(false);
                    } catch {}
                  }}
                >
                  Save
                </button>
              </div>
            )}
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
                  setTabs((prev) => prev.map((t) => (t.workspaceId === ws.id ? { ...t, workspaceName: ws.name ?? null } : t)));
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
                  setTabs((prev) => prev.map((t) => (t.threadId === th.id ? { ...t, threadTitle: th.title ?? null } : t)));
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
                  const prevTabs = tabs;
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
                  setTabs((prev) => prev.filter((t) => t.workspaceId !== wsId));
                  try {
                    await deleteWorkspace(wsId);
                  } catch {
                    setWorkspaces(prevWorkspaces);
                    setThreadsByWs(prevThreadsByWs);
                    setExpanded(prevExpanded);
                    setPanes(prevPanes);
                    setTabs(prevTabs);
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
                  const prevTabs = tabs;
                  closeDeleteThreadModal();
                  setThreadsByWs((prev) => ({
                    ...prev,
                    [wsId]: (prev[wsId] || []).filter((t) => t.id !== thId),
                  }));
                  setPanes((prev) => prev.filter((p) => p.threadId !== thId));
                  setTabs((prev) => prev.filter((t) => t.threadId !== thId));
                  try {
                    await deleteThread(thId);
                  } catch {
                    setThreadsByWs(prevThreadsByWs);
                    setPanes(prevPanes);
                    setTabs(prevTabs);
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
