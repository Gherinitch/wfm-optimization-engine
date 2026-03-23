// components/ui/Tooltip.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
}

export const Tooltip = ({ children, content }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  // We only want to open the portal on the client side to avoid Next.js hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    // Offset the tooltip slightly from the cursor
    setCoords({ x: e.clientX + 15, y: e.clientY + 15 });
  };

  return (
    <div
      // FIXED: Changed justify-center to justify-start to align the segment text to the left
      className="relative flex items-center justify-start w-full h-full"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onMouseMove={handleMouseMove}
    >
      {children}
      <AnimatePresence>
        {isVisible &&
          mounted &&
          // FIXED: React Portal teleports the tooltip out of the timeline so it never gets hidden under the sidebar
          createPortal(
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              style={{
                position: "fixed",
                left: coords.x,
                top: coords.y,
                zIndex: 999999,
              }}
              className="pointer-events-none min-w-[200px] max-w-xs bg-surface/95 backdrop-blur-md border border-surfaceBorder p-3 rounded-lg shadow-2xl ring-1 ring-white/10"
            >
              {content}
            </motion.div>,
            document.body,
          )}
      </AnimatePresence>
    </div>
  );
};
