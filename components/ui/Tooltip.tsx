// components/ui/Tooltip.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
}

export const Tooltip = ({ children, content }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  // FIXED: Using MotionValues instead of React State.
  // This completely removes the React render cycle from mouse movement, resulting in 60fps performance.
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    // Updates the CSS transform directly on the GPU
    mouseX.set(e.clientX + 15);
    mouseY.set(e.clientY + 15);
  };

  return (
    <>
      <div
        className="w-full h-full flex items-center justify-start min-w-0"
        onMouseEnter={(e) => {
          mouseX.set(e.clientX + 15);
          mouseY.set(e.clientY + 15);
          setIsVisible(true);
        }}
        onMouseLeave={() => setIsVisible(false)}
        onMouseMove={handleMouseMove}
      >
        {children}
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {isVisible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                style={{
                  position: "fixed",
                  left: 0,
                  top: 0,
                  // FIXED: Bound to hardware-accelerated X and Y transforms instead of layout Left/Top
                  x: mouseX,
                  y: mouseY,
                  zIndex: 9999999,
                }}
                className="pointer-events-none min-w-[200px] max-w-xs bg-surface/95 backdrop-blur-md border border-surfaceBorder p-3 rounded-lg shadow-2xl ring-1 ring-white/10"
              >
                {content}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};