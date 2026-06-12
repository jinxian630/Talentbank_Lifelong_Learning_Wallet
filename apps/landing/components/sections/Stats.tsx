"use client";

import { motion } from "framer-motion";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import XPProgressBar from "@/components/ui/XPProgressBar";

const STATS = [
  { target: 1000, suffix: "+", label: "Students Onboarded",   color: "var(--color-primary-orange)", icon: "🎓" },
  { target: 50,   suffix: "+", label: "Partner Events",        color: "var(--color-primary-blue)",   icon: "📅" },
  { target: 200,  suffix: "+", label: "Badges Issued On-Chain", color: "var(--color-accent-gold)",   icon: "🏅" },
];

const SKILL_BARS = [
  { label: "Web Development",   percent: 85, color: "var(--color-primary-orange)" },
  { label: "Data Science",       percent: 72, color: "var(--color-primary-blue)" },
  { label: "UI/UX Design",       percent: 64, color: "var(--color-accent-gold)" },
  { label: "Blockchain & Web3",  percent: 55, color: "var(--color-success-green)" },
];

export default function Stats() {
  return (
    <section id="stats" className="section-padding">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p
            className="text-sm font-bold tracking-widest uppercase mb-3"
            style={{ color: "var(--color-success-green)" }}
          >
            By The Numbers
          </p>
          <h2
            className="text-4xl sm:text-5xl font-extrabold"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text-dark)" }}
          >
            Growing Every{" "}
            <span style={{ color: "var(--color-success-green)" }}>Day</span>
          </h2>
        </motion.div>

        {/* Stats counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
              className="rounded-3xl p-8 flex flex-col items-center gap-3 text-center"
              style={{
                backgroundColor: "#fff",
                boxShadow: "0 4px 24px rgba(58,51,44,0.08)",
              }}
            >
              <span className="text-4xl">{stat.icon}</span>
              <div
                className="text-5xl font-extrabold"
                style={{ color: stat.color, fontFamily: "var(--font-heading)" }}
              >
                <AnimatedCounter target={stat.target} suffix={stat.suffix} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "#6b6059" }}>
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Skill XP bars */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl p-8 mx-auto max-w-2xl"
          style={{
            backgroundColor: "#fff",
            boxShadow: "0 4px 24px rgba(58,51,44,0.08)",
          }}
        >
          <h3
            className="text-xl font-bold mb-6 text-center"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text-dark)" }}
          >
            Top Skills Tracked on Platform
          </h3>
          <div className="flex flex-col gap-5">
            {SKILL_BARS.map((bar) => (
              <XPProgressBar
                key={bar.label}
                label={bar.label}
                percent={bar.percent}
                color={bar.color}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
