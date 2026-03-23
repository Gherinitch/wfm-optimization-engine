"use client";

import { useScheduleStore } from "@/store/useScheduleStore";
import { formatTime } from "@/utils/time";
import Link from "next/link";

export default function EditsPage() {
  const edits = useScheduleStore((state) => state.edits);
  const revertEdit = useScheduleStore((state) => state.revertEdit);
  const clearAllEdits = useScheduleStore((state) => state.clearAllEdits);
  const segments = useScheduleStore((state) => state.segments);
  const agents = useScheduleStore((state) => state.agents);

  // CSV Generation Engine
  const generateExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent +=
      "Agent ID,Agent Name,Segment Name,Category,Start Time,End Time\n";

    Object.values(segments).forEach((seg) => {
      const agent = agents[seg.agentId];
      if (!agent || seg.isGeneral) return;

      const row = [
        agent.id,
        agent.name,
        seg.name,
        seg.category,
        formatTime(seg.startMin),
        formatTime(seg.endMin),
      ].join(",");

      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ewfm_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen w-full bg-background text-gray-200 p-8 flex justify-center overflow-y-auto">
      <div className="max-w-4xl w-full flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surfaceBorder pb-6">
          <div>
            <h1 className="font-heading font-bold text-3xl tracking-wide text-white mb-2">
              Audit Ledger
            </h1>
            <p className="font-mono text-sm text-gray-400">
              Track changes, revert mistakes, and export to eWFM.
            </p>
          </div>
          <div className="flex gap-4">
            {edits.length > 0 && (
              <button
                onClick={generateExportCSV}
                className="px-4 py-2 font-mono text-sm font-bold bg-status-good text-background rounded hover:bg-green-500 transition-colors shadow-lg"
              >
                ↓ Export CSV
              </button>
            )}
            <Link href="/">
              <button className="px-4 py-2 font-mono text-sm font-bold bg-surface border border-surfaceBorder text-gray-300 rounded hover:bg-surfaceBorder hover:text-white transition-colors">
                ← Back to Timeline
              </button>
            </Link>
          </div>
        </div>

        {/* Ledger */}
        <div className="bg-surface border border-surfaceBorder rounded-xl overflow-hidden shadow-lg">
          <div className="bg-surfaceBorder/30 px-6 py-4 border-b border-surfaceBorder flex justify-between items-center">
            <h2 className="font-heading font-semibold text-white flex items-center gap-2">
              <span>📝</span> Pending Edits ({edits.length})
            </h2>
            {edits.length > 0 && (
              <button
                onClick={clearAllEdits}
                className="text-xs font-mono text-status-danger hover:text-red-400 transition-colors"
              >
                ⚠️ Revert All Changes
              </button>
            )}
          </div>

          <div className="flex flex-col">
            {edits.length === 0 ? (
              <div className="p-8 text-center text-gray-500 font-mono text-sm">
                No edits have been made to the schedule yet.
              </div>
            ) : (
              edits.map((edit) => (
                <div
                  key={edit.id}
                  className="flex items-center justify-between p-4 border-b border-surfaceBorder/50 hover:bg-surfaceBorder/20 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {edit.segmentName}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-status-info/20 text-status-info">
                        TIME CHANGE
                      </span>
                    </div>
                    <div className="font-mono text-xs text-gray-400 flex items-center gap-2">
                      <span className="line-through opacity-70">
                        {formatTime(edit.oldStartMin)} -{" "}
                        {formatTime(edit.oldEndMin)}
                      </span>
                      <span>→</span>
                      <span className="text-status-good font-bold">
                        {formatTime(edit.newStartMin)} -{" "}
                        {formatTime(edit.newEndMin)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => revertEdit(edit.id)}
                    className="px-3 py-1 bg-background border border-surfaceBorder rounded text-xs font-mono text-gray-400 hover:text-status-danger hover:border-status-danger/50 transition-colors"
                  >
                    Undo
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
