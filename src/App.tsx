export function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-gray-950 text-gray-100">
      <header className="flex h-12 items-center border-b border-gray-800 px-4">
        <h1 className="text-lg font-semibold tracking-tight">OpenClaw Office</h1>
        <span className="ml-3 rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
          v0.1.0
        </span>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 items-center justify-center text-gray-500">
          Phase 1 — 建设中
        </div>
      </main>
    </div>
  );
}
