"use client";

import { useScheduleStore } from "@/store/useScheduleStore";
import { motion, AnimatePresence } from "framer-motion";
import { formatTime } from "@/utils/time";

export const ValidationModal = () => {
  const pendingOverride = useScheduleStore((state) => state.pendingOverride);
  const setPendingOverride = useScheduleStore(
    (state) => state.setPendingOverride,
  );
  const confirmPendingOverride = useScheduleStore(
    (state) => state.confirmPendingOverride,
  );
  const segments = useScheduleStore((state) => state.segments);

  if (!pendingOverride) return null;

  const segment = segments[pendingOverride.segmentId];
  if (!segment) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-surface border border-surfaceBorder rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-status-danger/10 border-b border-status-danger/20 p-4 flex items-center gap-3">
            <div className="bg-status-danger/20 p-2 rounded-full text-status-danger">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <div>
              <h2 className="font-heading font-bold text-status-danger text-lg">
                Operational Violation
              </h2>
              <p className="font-mono text-xs text-status-danger/80">
                Action blocked by constraint engine
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 flex flex-col gap-4">
            <p className="text-gray-300 text-sm">
              Moving{" "}
              <span className="font-mono text-status-info bg-status-info/10 px-1 rounded">
                {segment.name}
              </span>{" "}
              to start at{" "}
              <span className="font-mono font-bold text-white">
                {formatTime(pendingOverride.newStart)}
              </span>{" "}
              will trigger the following rule violations:
            </p>

            <ul className="flex flex-col gap-2">
              {pendingOverride.violations.map((violation, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 bg-surfaceBorder/30 p-3 rounded border border-surfaceBorder/50"
                >
                  <span className="text-status-danger mt-0.5">•</span>
                  <span className="text-sm font-body text-gray-200 leading-tight">
                    {violation}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-gray-400 text-xs italic mt-2">
              Are you sure you want to force this override? This will be logged.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="bg-background border-t border-surfaceBorder p-4 flex justify-end gap-3">
            <button
              onClick={() => setPendingOverride(null)}
              className="px-4 py-2 font-mono text-sm text-gray-300 hover:text-white hover:bg-surfaceBorder rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmPendingOverride()}
              className="px-4 py-2 font-mono text-sm font-bold bg-status-danger text-white rounded hover:bg-red-600 transition-colors shadow-lg shadow-status-danger/20"
            >
              Force Override
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
