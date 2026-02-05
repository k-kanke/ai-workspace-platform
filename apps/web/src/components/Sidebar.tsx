"use client";

import { useCallback, useState } from "react";
import type { Workspace, Thread } from "@/lib/api";

export type OpenPane = {
  id: string;
  workspaceId: number;
  threadId: number;
  workspaceName?: string | null;
  threadTitle?: string | null;
};
export type SavedItem = { workspaceId: number; threadId: number; title?: string | null };

export default function Sidebar({
  panes,
  workspaces,
  expanded,
  threadsByWs,
  loadingWs,
  onNewPane,
  onToggleWs,
  onLoadThreads,
  onOpenThread,
  onCreateThread,
  onEditSystemPrompt,
  onEditKnowledge,
  onOpenKnowledgeTab,
}: {
  panes: OpenPane[];
  workspaces: Workspace[];
  expanded: Set<number>;
  threadsByWs: Record<number, Thread[]>;
  loadingWs: Set<number>;
  onNewPane: () => void;
  onToggleWs: (wsId: number) => void;
  onLoadThreads: (wsId: number) => void;
  onOpenThread: (wsId: number, thId: number) => void;
  onCreateThread: (wsId: number) => void;
  onEditSystemPrompt: (wsId: number) => void;
  onEditKnowledge: (wsId: number) => void;
  onOpenKnowledgeTab: () => void;
}) {
  const canOpen = panes.length < 3;
  const handleNew = useCallback(() => { onNewPane(); }, [onNewPane]);
  const [menuOpenWs, setMenuOpenWs] = useState<number | null>(null);
  return (
    <aside className="w-56 border-r border-zinc-200 bg-white h-[calc(100vh-49px)] sticky top-[49px] p-3 flex flex-col gap-3 shadow-sm">
      <button
        className="w-full text-sm px-3 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white"
        onClick={handleNew}
      >
        New Workspace
      </button>
      <button
        className="w-full text-sm px-3 py-2 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800"
        onClick={onOpenKnowledgeTab}
      >
        Knowledge
      </button>
      <div className="text-xs text-zinc-500 mt-1">Workspaces</div>
      <ul className="flex-1 overflow-auto pr-1 mt-1 flex flex-col gap-1">
        {workspaces.map(ws => {
          const isOpen = expanded.has(ws.id);
          const loading = loadingWs.has(ws.id);
          const threads = threadsByWs[ws.id] || [];
          return (
            <li key={`ws-${ws.id}`} className="border border-zinc-200 rounded-md bg-white">
              <div className="w-full text-sm px-2 py-2 flex items-center justify-between hover:bg-zinc-50 relative">
                <button
                  className="flex-1 text-left truncate"
                  onClick={() => {
                    setMenuOpenWs(null);
                    onToggleWs(ws.id);
                    if (!isOpen && threads.length === 0) onLoadThreads(ws.id);
                  }}
                >
                  {ws.name || `Workspace ${ws.id}`}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-100"
                    aria-haspopup="menu"
                    aria-expanded={menuOpenWs === ws.id}
                    title="Workspace actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenWs((prev) => (prev === ws.id ? null : ws.id));
                    }}
                  >•••</button>
                  <button
                    className="text-xs text-zinc-500"
                    title={isOpen ? 'Collapse' : 'Expand'}
                    onClick={(e) => { e.stopPropagation(); onToggleWs(ws.id); if (!isOpen && threads.length === 0) onLoadThreads(ws.id); }}
                  >{isOpen ? "▾" : "▸"}</button>
                </div>
                {menuOpenWs === ws.id && (
                  <div
                    className="absolute right-2 top-10 z-20 w-44 rounded-md border border-zinc-200 bg-white shadow-lg"
                    role="menu"
                  >
                    <button
                      className="w-full text-left text-xs px-3 py-2 hover:bg-zinc-50"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenWs(null);
                        onCreateThread(ws.id);
                      }}
                    >
                      New thread
                    </button>
                    <button
                      className="w-full text-left text-xs px-3 py-2 hover:bg-zinc-50 border-t border-zinc-100"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenWs(null);
                        onEditSystemPrompt(ws.id);
                      }}
                    >
                      Edit system prompt
                    </button>
                    <button
                      className="w-full text-left text-xs px-3 py-2 hover:bg-zinc-50 border-t border-zinc-100"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenWs(null);
                        onEditKnowledge(ws.id);
                      }}
                    >
                      Knowledge
                    </button>
                  </div>
                )}
              </div>
              {isOpen && (
                <ul className="px-2 pb-2 flex flex-col gap-1">
                  {loading && <li className="text-[11px] text-zinc-500 px-2 py-1">Loading...</li>}
                  {!loading && threads.length === 0 && (
                    <li className="text-[11px] text-zinc-400 px-2 py-1">No threads</li>
                  )}
                  {!loading && threads.map(th => (
                    <li key={`th-${th.id}`}>
                      <button
                        className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-zinc-50 ${canOpen ? '' : 'cursor-not-allowed opacity-60'}`}
                        onClick={() => { if (canOpen) onOpenThread(ws.id, th.id); }}
                        title={canOpen ? 'Open thread' : 'Maximum 3 panes open'}
                      >
                        TH {th.id} {th.title ? `- ${th.title}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <div className="text-[10px] text-zinc-400 mt-2">Max 3 panes open at once</div>
    </aside>
  );
}
