"use client";

import React from "react";
import { motion, useScroll, useSpring } from "framer-motion";

const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    mass: 0.4,
  });

  return (
    <motion.div
      style={{ scaleX, originX: 0 }}
      className="fixed top-0 left-0 right-0 z-[60] h-[2px] bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 shadow-[0_0_12px_rgba(52,211,153,0.55)] pointer-events-none"
    />
  );
};

export default ScrollProgress;
