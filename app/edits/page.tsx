// app/edits/page.tsx
"use client";

import { useScheduleStore } from "@/store/useScheduleStore";
import Link from "next/link";

const formatTime = (mins: number) => {
  const normalized = mins % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

export default function EditsPage() {
  const edits = useScheduleStore((state) => state.edits);
  const revertEdit = useScheduleStore((state) => state.revertEdit);
  const clearAllEdits = useScheduleStore((state) => state.clearAllEdits);

  return (
    <main className="h-screen w-screen flex flex-col bg-background text-gray-200 font-sans">
      <header className="flex items-center justify-between p-6 border-b border-surfaceBorder bg-surface flex-shrink-0">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">
            Audit Log & Edits
          </h1>
          <p className="text-sm text-gray-400">
            Review or revert schedule modifications.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={clearAllEdits}
            className="px-4 py-2 bg-status-danger/20 text-status-danger hover:bg-status-danger hover:text-white rounded transition-colors text-sm font-semibold"
          >
            Revert All
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-status-info hover:bg-blue-600 text-white rounded transition-colors text-sm font-semibold"
          >
            Back to Timeline
          </Link>
        </div>
      </header>

      {/* FIXED: Added flex-1 and overflow-y-auto here so the list becomes scrollable */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-4">
          {edits.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              No edits have been made yet.
            </div>
          ) : (
            edits.map((edit) => (
              <div
                key={edit.id}
                className="bg-surface border border-surfaceBorder rounded-lg p-4 flex items-center justify-between shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-white">
                      {edit.segmentName}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-surfaceBorder rounded text-gray-400">
                      {edit.type}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 font-mono">
                    Changed from{" "}
                    <span className="text-status-danger">
                      {formatTime(edit.oldStartMin)} -{" "}
                      {formatTime(edit.oldEndMin)}
                    </span>{" "}
                    to{" "}
                    <span className="text-status-good">
                      {formatTime(edit.newStartMin)} -{" "}
                      {formatTime(edit.newEndMin)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(edit.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => revertEdit(edit.id)}
                  className="px-3 py-1.5 bg-surfaceBorder hover:bg-status-warning hover:text-black rounded text-sm transition-colors"
                >
                  Revert
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
