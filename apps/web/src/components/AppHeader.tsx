"use client";

export default function AppHeader({
  onToggleSidebar,
  sidebarOpen,
  onNewThread,
}: {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  onNewThread?: () => void;
} = {}) {
  return (
    <header className="w-full border-b border-zinc-200 bg-gradient-to-b from-white to-zinc-50 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-[1400px] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onToggleSidebar && (
            <button
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-zinc-200 hover:bg-zinc-100 text-zinc-700"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <span className="text-lg leading-none">{sidebarOpen ? "⟨" : "☰"}</span>
            </button>
          )}
          <div className="font-semibold tracking-tight">AI Workspace Platform</div>
        </div>
        <div className="flex items-center gap-2">
          {onNewThread && (
            <button
              className="text-sm px-3 py-1.5 rounded-md border border-zinc-200 hover:bg-zinc-100"
              onClick={onNewThread}
            >New Thread</button>
          )}
          <div className="text-xs text-zinc-500">MVP</div>
        </div>
      </div>
    </header>
  );
}
