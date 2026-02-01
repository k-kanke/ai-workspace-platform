"use client";

import { useCallback } from "react";

export type OpenPane = { id: string; workspaceId: number; threadId: number; title?: string | null };

export default function Sidebar({ panes, onNewPane, onClosePane, onFocus }: {
  panes: OpenPane[];
  onNewPane: () => void;
  onClosePane: (id: string) => void;
  onFocus: (id: string) => void;
}) {
  const canOpen = panes.length < 3;
  const handleNew = useCallback(() => { if (canOpen) onNewPane(); }, [canOpen, onNewPane]);
  return (
    <aside className="w-56 border-r border-zinc-200 bg-white h-[calc(100vh-49px)] sticky top-[49px] p-3 flex flex-col gap-3 shadow-sm">
      <button
        className="w-full text-sm px-3 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-50"
        onClick={handleNew}
        disabled={!canOpen}
      >
        New Workspace
      </button>
      <div className="text-xs text-zinc-500">Open Workspaces</div>
      <ul className="flex-1 flex flex-col gap-1 overflow-auto pr-1">
        {panes.map(p => (
          <li key={p.id} className="group flex items-center justify-between gap-2 border border-zinc-200 rounded-md px-2 py-2 bg-white hover:shadow-sm">
            <button className="text-left text-sm truncate flex-1" onClick={() => onFocus(p.id)}>
              WS {p.workspaceId} / TH {p.threadId}
            </button>
            <button className="text-xs text-zinc-500 hover:text-red-600" onClick={() => onClosePane(p.id)}>×</button>
          </li>
        ))}
      </ul>
      <div className="text-[10px] text-zinc-400">Max 3 panes</div>
    </aside>
  );
}
