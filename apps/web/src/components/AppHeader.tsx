"use client";

export default function AppHeader() {
  return (
    <header className="w-full border-b border-zinc-200 bg-gradient-to-b from-white to-zinc-50 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-[1400px] px-4 py-3 flex items-center justify-between">
        <div className="font-semibold tracking-tight">AI Workspace Platform</div>
        <div className="text-xs text-zinc-500">MVP</div>
      </div>
    </header>
  );
}
