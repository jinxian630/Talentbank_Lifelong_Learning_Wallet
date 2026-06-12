"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconColor?: string;
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  iconColor = "var(--color-primary-orange)",
}: FeatureCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="rounded-2xl p-6 flex flex-col gap-3 cursor-default"
      style={{
        backgroundColor: "#fff",
        boxShadow: "0 4px 24px 0 rgba(58,51,44,0.08)",
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${iconColor}18` }}
      >
        <Icon size={24} style={{ color: iconColor }} strokeWidth={2} />
      </div>
      <h3 className="text-lg font-bold" style={{ color: "var(--color-text-dark)" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "#6b6059" }}>
        {description}
      </p>
    </motion.div>
  );
}
