"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface XPProgressBarProps {
  label: string;
  percent: number;
  color?: string;
}

export default function XPProgressBar({
  label,
  percent,
  color = "var(--color-primary-orange)",
}: XPProgressBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div ref={ref} className="w-full">
      <div className="mb-1 flex items-center justify-between text-sm font-semibold">
        <span style={{ color: "var(--color-text-dark)" }}>{label}</span>
        <span style={{ color }}>{percent}%</span>
      </div>
      <div
        className="h-3 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--color-shadow-grey)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={isInView ? { width: `${percent}%` } : { width: 0 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
        />
      </div>
    </div>
  );
}
