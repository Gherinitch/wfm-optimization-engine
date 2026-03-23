// components/ui/Tooltip.tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
}

export const Tooltip = ({ children, content }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    // Offset the tooltip slightly from the cursor
    setCoords({ x: e.clientX + 15, y: e.clientY + 15 });
  };

  return (
    <div
      className="relative flex items-center h-full"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onMouseMove={handleMouseMove}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{
              position: "fixed",
              left: coords.x,
              top: coords.y,
              zIndex: 9999,
            }}
            className="pointer-events-none min-w-[200px] max-w-xs bg-surface/95 backdrop-blur-md border border-surfaceBorder p-3 rounded-lg shadow-2xl ring-1 ring-white/10"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
